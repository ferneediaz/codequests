#!/bin/bash
# Setup script for cgroups v1 hybrid mode (for Judge0/isolate compatibility)
# Run with: sudo ./setup-cgroups-v1.sh

set -e

echo "Setting up cgroups v1 compatibility for Judge0..."

# Check if already in hybrid mode
if [ -d "/sys/fs/cgroup/memory" ]; then
    echo "✅ cgroups v1 memory controller already available"
    exit 0
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo $0"
    exit 1
fi

# Create cgroup v1 mount points
echo "Creating cgroups v1 mount points..."

mkdir -p /sys/fs/cgroup/memory
mkdir -p /sys/fs/cgroup/cpuacct
mkdir -p /sys/fs/cgroup/pids

# Mount cgroup v1 controllers
echo "Mounting cgroups v1 controllers..."

if ! mountpoint -q /sys/fs/cgroup/memory; then
    mount -t cgroup -o memory cgroup /sys/fs/cgroup/memory || {
        echo "⚠️ Could not mount memory cgroup controller"
        echo "You may need to enable hybrid cgroups via GRUB:"
        echo "1. Edit /etc/default/grub"
        echo "2. Add systemd.unified_cgroup_hierarchy=0 to GRUB_CMDLINE_LINUX"
        echo "3. Run: sudo update-grub && sudo reboot"
        exit 1
    }
fi

if ! mountpoint -q /sys/fs/cgroup/cpuacct; then
    mount -t cgroup -o cpuacct cgroup /sys/fs/cgroup/cpuacct || echo "⚠️ Could not mount cpuacct"
fi

if ! mountpoint -q /sys/fs/cgroup/pids; then
    mount -t cgroup -o pids cgroup /sys/fs/cgroup/pids || echo "⚠️ Could not mount pids"
fi

# Update permissions
chmod 755 /sys/fs/cgroup/memory
chmod 755 /sys/fs/cgroup/cpuacct
chmod 755 /sys/fs/cgroup/pids

echo "✅ cgroups v1 controllers mounted successfully!"
echo ""
echo "Now restart Judge0 containers:"
echo "  cd server && docker-compose up -d"
