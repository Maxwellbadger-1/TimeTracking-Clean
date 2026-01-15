#!/bin/bash

# TimeTracking Development Stop Script
# Properly kills process trees including all children

echo "🛑 Stopping all development processes..."

# Function to kill process tree
kill_tree() {
    local pid=$1
    local sig=${2:-TERM}

    # Get all children recursively
    local children=$(pgrep -P $pid 2>/dev/null)

    # Kill children first (recursive)
    for child in $children; do
        kill_tree $child $sig
    done

    # Kill the process itself
    kill -$sig $pid 2>/dev/null
}

# Find and kill npm processes with their children
for pid in $(pgrep -f "npm.*start" 2>/dev/null); do
    echo "  Killing npm process tree $pid..."
    kill_tree $pid TERM
    sleep 0.5
    kill -9 $pid 2>/dev/null  # Force kill if still alive
done

# Find and kill tauri/cargo processes
for pid in $(pgrep -f "tauri dev" 2>/dev/null); do
    echo "  Killing tauri process tree $pid..."
    kill_tree $pid TERM
    sleep 0.5
    kill -9 $pid 2>/dev/null
done

# Brute force cleanup for anything that survived
killall -TERM node npm vite cargo tauri desktop 2>/dev/null
sleep 1
killall -9 node npm vite cargo tauri desktop 2>/dev/null

# Kill by port (if processes are listening)
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:1420 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:1421 2>/dev/null | xargs kill -9 2>/dev/null

# Remove lockfile
rm -f /tmp/timetracking-dev.lock

echo ""
echo "✅ All development processes stopped!"
echo "   (Ports 3000, 1420, 1421 are now free)"
