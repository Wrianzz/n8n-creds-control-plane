#!/usr/bin/env bash
set -euo pipefail

curl -sS http://localhost:8080/api/workflow-maps/validate \
  -H 'content-type: application/json' \
  -H 'x-user-email: operator@example.com' \
  -H 'x-user-role: editor' \
  -d '{
    "branchName": "workflow/iANRp7830QB1Jm2z",
    "workflowId": "iANRp7830QB1Jm2z",
    "selectedSubworkflowIds": [],
    "maps": [
      {
        "workflowId": "iANRp7830QB1Jm2z",
        "entries": [
          {
            "nodeName": "Execute a SQL query",
            "credentialName": "TEST PSQL-Production",
            "credentialId": "fyglbtpDUghobyaK"
          }
        ]
      }
    ]
  }' | jq .
