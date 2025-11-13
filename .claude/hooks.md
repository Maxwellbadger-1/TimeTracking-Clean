# Claude Code Hooks - Auto-Approve Configuration

## Tool Approval Hooks

### Auto-approve common development commands
```bash
# Git operations
if [[ $TOOL == "Bash" && $COMMAND =~ ^git ]]; then
  echo "allow"
fi

# npm/node operations
if [[ $TOOL == "Bash" && $COMMAND =~ ^(npm|node|npx) ]]; then
  echo "allow"
fi

# File operations (ls, cat, grep, find)
if [[ $TOOL == "Bash" && $COMMAND =~ ^(ls|cat|grep|find|head|tail|wc) ]]; then
  echo "allow"
fi

# Process management
if [[ $TOOL == "Bash" && $COMMAND =~ ^(ps|kill|killall|pkill) ]]; then
  echo "allow"
fi

# Development servers
if [[ $TOOL == "Bash" && $COMMAND =~ (SIMPLE-START|stop-dev|npm run) ]]; then
  echo "allow"
fi

# Database operations
if [[ $TOOL == "Bash" && $COMMAND =~ ^sqlite3 ]]; then
  echo "allow"
fi
```

### Auto-approve file reading/writing
```bash
if [[ $TOOL == "Read" || $TOOL == "Write" || $TOOL == "Edit" ]]; then
  echo "allow"
fi
```

### Auto-approve search operations
```bash
if [[ $TOOL == "Grep" || $TOOL == "Glob" ]]; then
  echo "allow"
fi
```

## Block dangerous operations
```bash
# Never auto-approve rm -rf on root or home
if [[ $TOOL == "Bash" && $COMMAND =~ "rm -rf /" ]]; then
  echo "deny"
fi

# Never auto-approve password changes
if [[ $TOOL == "Bash" && $COMMAND =~ passwd ]]; then
  echo "deny"
fi
```

## Notes
- These hooks run BEFORE Claude asks for permission
- Return "allow" to auto-approve
- Return "deny" to auto-reject
- Return nothing to show normal permission dialog