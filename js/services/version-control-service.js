/* ============================================
   Document Version Control Service
   Track changes and manage document versions
   ============================================ */

class VersionControlService {
    constructor() {
        this.versions = JSON.parse(localStorage.getItem('mhs_document_versions') || '{}');
    }

    // Create a new version of a document
    createVersion(documentId, documentType, content, metadata = {}) {
        if (!this.versions[documentId]) {
            this.versions[documentId] = {
                id: documentId,
                type: documentType, // angebot, rechnung, vertrag, etc.
                versions: [],
                createdAt: new Date().toISOString()
            };
        }

        const versionNumber = this.versions[documentId].versions.length + 1;

        const version = {
            versionId: `${documentId}-v${versionNumber}`,
            number: versionNumber,
            content: content, // Can be full content or diff
            contentHash: this.hashContent(JSON.stringify(content)),
            changes: metadata.changes || [],
            changedBy: metadata.changedBy || 'system',
            changeReason: metadata.changeReason || '',
            createdAt: new Date().toISOString(),
            status: metadata.status || 'draft' // draft, reviewed, approved, archived
        };

        this.versions[documentId].versions.push(version);
        this.versions[documentId].currentVersion = versionNumber;
        this.versions[documentId].updatedAt = new Date().toISOString();

        this.save();
        return version;
    }

    // Get all versions for a document
    getVersions(documentId) {
        return this.versions[documentId]?.versions || [];
    }

    // Get specific version
    getVersion(documentId, versionNumber) {
        const docVersions = this.versions[documentId];
        if (!docVersions) {return null;}
        return docVersions.versions.find(v => v.number === versionNumber);
    }

    // Get latest version
    getLatestVersion(documentId) {
        const docVersions = this.versions[documentId];
        if (!docVersions || docVersions.versions.length === 0) {return null;}
        return docVersions.versions[docVersions.versions.length - 1];
    }

    // Compare two versions
    compareVersions(documentId, version1, version2) {
        const v1 = this.getVersion(documentId, version1);
        const v2 = this.getVersion(documentId, version2);

        if (!v1 || !v2) {return null;}

        const comparison = {
            documentId: documentId,
            version1: version1,
            version2: version2,
            differences: []
        };

        // Deep compare content
        const diff = this.deepDiff(v1.content, v2.content);
        comparison.differences = diff;
        comparison.hasChanges = diff.length > 0;

        return comparison;
    }

    // Deep diff two objects
    deepDiff(obj1, obj2, path = '') {
        const differences = [];

        // Handle primitives
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
            if (obj1 !== obj2) {
                differences.push({
                    path: path || 'value',
                    type: 'changed',
                    oldValue: obj1,
                    newValue: obj2
                });
            }
            return differences;
        }

        // Handle nulls
        if (obj1 === null || obj2 === null) {
            if (obj1 !== obj2) {
                differences.push({
                    path: path || 'value',
                    type: obj1 === null ? 'added' : 'removed',
                    oldValue: obj1,
                    newValue: obj2
                });
            }
            return differences;
        }

        // Get all keys
        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;

            if (!(key in obj1)) {
                differences.push({
                    path: currentPath,
                    type: 'added',
                    oldValue: undefined,
                    newValue: obj2[key]
                });
            } else if (!(key in obj2)) {
                differences.push({
                    path: currentPath,
                    type: 'removed',
                    oldValue: obj1[key],
                    newValue: undefined
                });
            } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
                differences.push(...this.deepDiff(obj1[key], obj2[key], currentPath));
            } else if (obj1[key] !== obj2[key]) {
                differences.push({
                    path: currentPath,
                    type: 'changed',
                    oldValue: obj1[key],
                    newValue: obj2[key]
                });
            }
        }

        return differences;
    }

    // Restore a previous version
    restoreVersion(documentId, versionNumber) {
        const version = this.getVersion(documentId, versionNumber);
        if (!version) {return null;}

        // Create a new version with restored content
        const restoredVersion = this.createVersion(
            documentId,
            this.versions[documentId].type,
            version.content,
            {
                changes: [`Wiederhergestellt von Version ${versionNumber}`],
                changeReason: `Version ${versionNumber} wiederhergestellt`
            }
        );

        return restoredVersion;
    }

    // Get version history summary
    getVersionHistory(documentId) {
        const docVersions = this.versions[documentId];
        if (!docVersions) {return [];}

        return docVersions.versions.map(v => ({
            versionId: v.versionId,
            number: v.number,
            changedBy: v.changedBy,
            changeReason: v.changeReason,
            changes: v.changes.length,
            status: v.status,
            createdAt: v.createdAt,
            formattedDate: new Date(v.createdAt).toLocaleString('de-DE')
        }));
    }

    // Update version status
    updateVersionStatus(documentId, versionNumber, status) {
        const version = this.getVersion(documentId, versionNumber);
        if (!version) {return null;}

        version.status = status;
        version.statusUpdatedAt = new Date().toISOString();

        this.save();
        return version;
    }

    // Simple hash for content comparison
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // Get documents with version control
    getAllDocuments() {
        return Object.entries(this.versions).map(([id, doc]) => ({
            id: id,
            type: doc.type,
            currentVersion: doc.currentVersion,
            totalVersions: doc.versions.length,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        }));
    }

    // Delete version history for a document
    deleteVersionHistory(documentId) {
        delete this.versions[documentId];
        this.save();
    }

    // Export version history
    exportHistory(documentId) {
        const docVersions = this.versions[documentId];
        if (!docVersions) {return null;}

        return {
            documentId: documentId,
            type: docVersions.type,
            exportedAt: new Date().toISOString(),
            versions: docVersions.versions
        };
    }

    // Statistics
    getStatistics() {
        const docs = Object.values(this.versions);
        return {
            totalDocuments: docs.length,
            totalVersions: docs.reduce((sum, d) => sum + d.versions.length, 0),
            recentChanges: docs
                .flatMap(d => d.versions)
                .filter(v => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return new Date(v.createdAt) >= weekAgo;
                })
                .length
        };
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_document_versions', JSON.stringify(this.versions));
    }
}

window.versionControlService = new VersionControlService();
