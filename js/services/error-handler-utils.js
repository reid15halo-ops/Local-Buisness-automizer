/* ============================================
   Error Handler Utilities

   Helper functions and wrappers for common
   error handling patterns used throughout
   the application.
   ============================================ */

/**
 * Wrap async operations with error handling
 * @param {Promise} operation - The async operation to execute
 * @param {string} operationName - Name for debugging/logging
 * @param {object} options - Configuration options
 * @returns {Promise} The result or null on error
 */
async function withErrorHandling(operation, operationName = 'Operation', options = {}) {
    try {
        return await operation;
    } catch (error) {
        console.error(`[${operationName}] Failed:`, error);

        if (window.ErrorDisplay) {
            const errorType = window.ErrorDisplay.classifyError(error);

            if (options.silent !== true) {
                window.ErrorDisplay.showError(
                    options.errorType || errorType,
                    {
                        originalError: error.message,
                        field: options.field
                    }
                );
            }
        }

        if (options.onError) {
            options.onError(error);
        }

        return options.returnNull !== false ? null : undefined;
    }
}

/**
 * Wrap sync operations with error handling
 * @param {function} operation - The sync operation to execute
 * @param {string} operationName - Name for debugging/logging
 * @param {object} options - Configuration options
 * @returns {any} The result or null on error
 */
function withSyncErrorHandling(operation, operationName = 'Operation', options = {}) {
    try {
        return operation();
    } catch (error) {
        console.error(`[${operationName}] Failed:`, error);

        if (window.ErrorDisplay) {
            const errorType = window.ErrorDisplay.classifyError(error);

            if (options.silent !== true) {
                window.ErrorDisplay.showError(
                    options.errorType || errorType,
                    {
                        originalError: error.message,
                        field: options.field
                    }
                );
            }
        }

        if (options.onError) {
            options.onError(error);
        }

        return options.returnNull !== false ? null : undefined;
    }
}

/**
 * Fetch with friendly error handling
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<any>} The response data or null on error
 */
async function fetchWithErrorHandling(url, options = {}) {
    const { timeout = 30000, ...fetchOptions } = options;

    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = {
                status: response.status,
                statusText: response.statusText,
                url: url
            };

            // Map HTTP status to error type
            let errorType = 'load';
            if (response.status === 404) {
                errorType = 'notfound';
            } else if (response.status === 403 || response.status === 401) {
                errorType = 'permission';
            } else if (response.status >= 500) {
                errorType = 'load';
            }

            throw {
                message: `HTTP ${response.status}: ${response.statusText}`,
                status: response.status,
                type: errorType
            };
        }

        return await response.json();
    } catch (error) {
        console.error('[fetchWithErrorHandling] Failed:', { url, error });

        if (error.name === 'AbortError') {
            if (window.ErrorDisplay) {
                window.ErrorDisplay.showError('timeout', {
                    originalError: 'Request timeout'
                });
            }
        } else if (!navigator.onLine) {
            if (window.ErrorDisplay) {
                window.ErrorDisplay.showError('network', {
                    originalError: 'No internet connection'
                });
            }
        } else {
            const errorType = error.type || window.ErrorDisplay?.classifyError(error) || 'load';
            if (window.ErrorDisplay) {
                window.ErrorDisplay.showError(errorType, {
                    originalError: error.message
                });
            }
        }

        return null;
    }
}

/**
 * Parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {string} context - Context for error messages
 * @returns {object|null} Parsed object or null on error
 */
function parseJSONSafely(jsonString, context = 'JSON') {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error(`[parseJSONSafely] Failed to parse ${context}:`, error);

        if (window.ErrorDisplay) {
            window.ErrorDisplay.showError('validation', {
                field: context
            });
        }

        return null;
    }
}

/**
 * Validate form fields and show errors
 * @param {object} data - Object to validate
 * @param {object} schema - Validation schema
 * @returns {object} { valid: boolean, errors: array }
 */
function validateFormFields(data, schema) {
    const errors = [];

    Object.keys(schema).forEach(fieldName => {
        const rule = schema[fieldName];
        const value = data[fieldName];

        // Check required
        if (rule.required && !value) {
            errors.push({
                field: fieldName,
                message: `${rule.label || fieldName} ist erforderlich.`
            });
        }

        // Check email
        if (rule.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                errors.push({
                    field: fieldName,
                    message: 'Geben Sie eine gültige E-Mail-Adresse ein.'
                });
            }
        }

        // Check min length
        if (rule.minLength && value && value.length < rule.minLength) {
            errors.push({
                field: fieldName,
                message: `${rule.label || fieldName} muss mindestens ${rule.minLength} Zeichen lang sein.`
            });
        }

        // Check max length
        if (rule.maxLength && value && value.length > rule.maxLength) {
            errors.push({
                field: fieldName,
                message: `${rule.label || fieldName} darf nicht länger als ${rule.maxLength} Zeichen sein.`
            });
        }

        // Check custom validator
        if (rule.validator && value) {
            const validationResult = rule.validator(value);
            if (validationResult !== true) {
                errors.push({
                    field: fieldName,
                    message: validationResult || `${rule.label || fieldName} ist ungültig.`
                });
            }
        }
    });

    const valid = errors.length === 0;

    if (!valid && window.ErrorDisplay) {
        window.ErrorDisplay.showValidationErrors(errors);
    }

    return { valid, errors };
}

/**
 * Create a retry wrapper for failed operations
 * @param {function} operation - Operation to retry
 * @param {object} options - Retry options
 * @returns {Promise} Operation result
 */
async function retryWithBackoff(operation, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        backoffMultiplier = 2,
        onRetry = null
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                console.warn(`[retryWithBackoff] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);

                if (onRetry) {
                    onRetry(attempt + 1, maxRetries, delay);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * backoffMultiplier, maxDelay);
            }
        }
    }

    console.error('[retryWithBackoff] All retries exhausted:', lastError);
    throw lastError;
}

/**
 * Format error message for display
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default message if error is unclear
 * @returns {string} Formatted error message
 */
function formatErrorMessage(error, defaultMessage = 'Ein Fehler ist aufgetreten.') {
    if (!error) {return defaultMessage;}

    if (typeof error === 'string') {return error;}

    if (error.userMessage) {return error.userMessage;}

    if (error.message) {return error.message;}

    return defaultMessage;
}

/**
 * Create a debounced operation with error handling
 * @param {function} operation - Operation to debounce
 * @param {number} delay - Debounce delay in ms
 * @returns {function} Debounced function
 */
function createDebouncedOperation(operation, delay = 300) {
    let timeoutId;

    return function debouncedOperation(...args) {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(async () => {
            try {
                await operation(...args);
            } catch (error) {
                console.error('[debouncedOperation] Failed:', error);

                if (window.ErrorDisplay) {
                    window.ErrorDisplay.showError(
                        window.ErrorDisplay.classifyError(error),
                        { originalError: error.message }
                    );
                }
            }
        }, delay);
    };
}

/**
 * Handle network request with timeout and error handling
 * @param {string} url - URL to request
 * @param {object} options - Request options
 * @returns {Promise<Response>} Fetch response
 */
async function requestWithTimeout(url, options = {}) {
    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw {
                message: 'Die Anfrage hat zu lange gedauert.',
                type: 'timeout'
            };
        }

        throw error;
    }
}

/* ============================================
   Legacy Compatibility Wrappers
   For existing code using showToast()
   ============================================ */

/**
 * Legacy showToast compatibility function
 * Maps old error messages to new system
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, warning, info)
 */
window.showToastCompat = function(message, type = 'info') {
    if (!window.ErrorDisplay) {return;}

    switch (type) {
        case 'success':
            window.ErrorDisplay.showSuccess(message);
            break;
        case 'error':
            window.ErrorDisplay.showError('unknown', { message });
            break;
        case 'warning':
            window.ErrorDisplay.showWarning(message);
            break;
        case 'info':
        default:
            window.ErrorDisplay.showInfo(message);
            break;
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        withErrorHandling,
        withSyncErrorHandling,
        fetchWithErrorHandling,
        parseJSONSafely,
        validateFormFields,
        retryWithBackoff,
        formatErrorMessage,
        createDebouncedOperation,
        requestWithTimeout
    };
}
