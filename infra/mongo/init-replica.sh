#!/bin/bash
set -euo pipefail

mongosh --host mongodb --quiet <<'EOF'
try {
  rs.status()
} catch (error) {
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongodb:27017" }]
  })
}
EOF
