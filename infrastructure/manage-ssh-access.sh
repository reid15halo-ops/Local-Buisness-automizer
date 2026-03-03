#!/bin/bash

#############################################################################
# SSH Access Management Script for Local Business Automizer Network
#
# This script provides utilities to manage SSH access across all devices:
# - Add SSH key to all devices
# - Remove SSH key from all devices
# - Check SSH access to all devices
# - Monitor SSH activity
#
# Usage: ./manage-ssh-access.sh [command] [options]
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SSH_DIR="$HOME/.ssh"
KEY_NAME="lba-network"
KEY_PATH="$SSH_DIR/$KEY_NAME"

# Define all devices
declare -A DEVICES=(
    [pi4]="pi@192.168.1.100"
    [gaming-rig]="localadmin@192.168.1.101"
    [hp-kiosk]="kiosk@192.168.1.102"
    [thinkcenter]="admin@192.168.1.103"
    [nas-backup]="nas-admin@192.168.1.104"
    [hetzner-vps]="root@INSERT_IP_HERE"
    [email-relay]="deploy@INSERT_IP_HERE"
)

#############################################################################
# Functions
#############################################################################

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

usage() {
    cat << EOF
${BLUE}SSH Access Management for Local Business Automizer${NC}

Usage: $0 [command] [options]

Commands:
  add-key [host]          Add public key to a device
                          If no host specified, add to all devices

  remove-key [host]       Remove public key from a device
                          If no host specified, remove from all devices

  check-access [host]     Check SSH access to device(s)
                          If no host specified, check all devices

  list-keys [host]        List authorized keys on device
                          If no host specified, list for all devices

  rotate-keys             Rotate all SSH keys (generates new key)

  test-connections        Test connectivity to all devices

  monitor [host]          Monitor SSH activity on device

  help                    Show this help message

Examples:
  $0 add-key pi4              # Add key to Pi4
  $0 add-key                  # Add key to all devices
  $0 check-access             # Check access to all devices
  $0 test-connections         # Test all connections
  $0 monitor pi4              # Monitor Pi4 SSH activity

EOF
}

check_key_exists() {
    if [ ! -f "$KEY_PATH" ]; then
        print_error "SSH key not found at $KEY_PATH"
        echo "Run: ./setup-ssh-keys.sh"
        exit 1
    fi
}

add_key_to_device() {
    local host=$1
    local user_host=${DEVICES[$host]}

    if [ -z "$user_host" ]; then
        print_error "Unknown host: $host"
        return 1
    fi

    print_header "Adding key to $host ($user_host)"

    if ssh-copy-id -i "$KEY_PATH" "$user_host" 2>/dev/null; then
        print_success "Key added to $host"
        return 0
    else
        print_error "Failed to add key to $host"
        echo "Manual setup needed. On $host, run:"
        echo "  mkdir -p ~/.ssh"
        echo "  cat >> ~/.ssh/authorized_keys << 'EOF'"
        cat "$KEY_PATH.pub"
        echo "  EOF"
        echo "  chmod 600 ~/.ssh/authorized_keys"
        return 1
    fi
}

add_key_all() {
    print_header "Adding key to all devices"

    local success=0
    local failed=0

    for host in "${!DEVICES[@]}"; do
        if add_key_to_device "$host"; then
            ((success++))
        else
            ((failed++))
        fi
    done

    echo ""
    print_success "Added to $success device(s)"
    if [ $failed -gt 0 ]; then
        print_warning "Failed for $failed device(s)"
    fi
}

check_access_device() {
    local host=$1
    local user_host=${DEVICES[$host]}

    if [ -z "$user_host" ]; then
        print_error "Unknown host: $host"
        return 1
    fi

    echo -n "Checking $host... "

    if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
        -i "$KEY_PATH" "$user_host" "echo 'OK'" 2>/dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

check_access_all() {
    print_header "Checking SSH access to all devices"

    local success=0
    local failed=0

    for host in "${!DEVICES[@]}"; do
        if check_access_device "$host"; then
            ((success++))
        else
            ((failed++))
        fi
    done

    echo ""
    echo "Summary: ${GREEN}$success OK${NC} / ${RED}$failed FAILED${NC}"
}

list_keys_device() {
    local host=$1
    local user_host=${DEVICES[$host]}

    if [ -z "$user_host" ]; then
        print_error "Unknown host: $host"
        return 1
    fi

    print_header "Authorized keys on $host"

    if ssh -o ConnectTimeout=5 -i "$KEY_PATH" "$user_host" \
        "cat ~/.ssh/authorized_keys 2>/dev/null || echo 'No authorized_keys file'" 2>/dev/null; then
        return 0
    else
        print_error "Failed to list keys on $host"
        return 1
    fi
}

rotate_keys() {
    print_header "SSH Key Rotation"

    echo -e "${YELLOW}This will generate a new SSH key.${NC}\n"

    read -p "Enter comment for new key [lba-network-$(date +%s)]: " comment
    comment=${comment:-"lba-network-$(date +%s)"}

    local new_key_path="$SSH_DIR/lba-network-rotated-$(date +%s)"

    echo -e "\n${YELLOW}Generating new key...${NC}"
    ssh-keygen -t ed25519 -C "$comment" -f "$new_key_path" -N ""
    chmod 600 "$new_key_path"

    print_success "New key generated: $new_key_path"

    echo -e "\n${YELLOW}New public key:${NC}"
    cat "$new_key_path.pub"

    echo -e "\n${YELLOW}To complete rotation:${NC}"
    echo "1. Add new key to all devices with: $0 add-key"
    echo "2. Verify access with: $0 check-access"
    echo "3. Remove old key: ssh <host> 'sed -i /old-key-fingerprint/d ~/.ssh/authorized_keys'"
    echo "4. Update ~/.ssh/config to use new key"
}

test_connections() {
    print_header "Testing connections to all devices"

    check_access_all
}

monitor_device() {
    local host=$1
    local user_host=${DEVICES[$host]}

    if [ -z "$user_host" ]; then
        print_error "Unknown host: $host"
        return 1
    fi

    print_header "Monitoring SSH activity on $host"

    echo "Press Ctrl+C to stop monitoring"
    echo ""

    ssh -i "$KEY_PATH" "$user_host" "tail -f /var/log/auth.log" 2>/dev/null || \
    ssh -i "$KEY_PATH" "$user_host" "tail -f /var/log/system.log" 2>/dev/null || \
    print_error "Could not access system logs on $host"
}

list_devices() {
    print_header "Available devices"

    for host in "${!DEVICES[@]}"; do
        echo "  $host: ${DEVICES[$host]}"
    done
}

#############################################################################
# Main
#############################################################################

COMMAND=${1:-help}

case "$COMMAND" in
    add-key)
        check_key_exists
        if [ -z "$2" ]; then
            add_key_all
        else
            add_key_to_device "$2"
        fi
        ;;

    remove-key)
        print_error "Not yet implemented"
        ;;

    check-access)
        check_key_exists
        if [ -z "$2" ]; then
            check_access_all
        else
            check_access_device "$2"
        fi
        ;;

    list-keys)
        check_key_exists
        if [ -z "$2" ]; then
            for host in "${!DEVICES[@]}"; do
                list_keys_device "$host"
            done
        else
            list_keys_device "$2"
        fi
        ;;

    rotate-keys)
        check_key_exists
        rotate_keys
        ;;

    test-connections)
        check_key_exists
        test_connections
        ;;

    monitor)
        check_key_exists
        if [ -z "$2" ]; then
            print_error "Monitor requires a host argument"
            echo "Usage: $0 monitor [host]"
            list_devices
        else
            monitor_device "$2"
        fi
        ;;

    list|list-devices)
        list_devices
        ;;

    help|--help|-h)
        usage
        ;;

    *)
        print_error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac
