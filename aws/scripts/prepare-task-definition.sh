#!/bin/bash

# Helper script to prepare task definition with conditional SSL secrets

set -e

TASK_DEF_TEMPLATE="$1"
TASK_DEF_OUTPUT="$2"
TASK_EXECUTION_ROLE_ARN="$3"
TASK_ROLE_ARN="$4"
ECR_IMAGE_URI="$5"
SECRET_ARN="$6"
CORS_ORIGINS="$7"
SSL_CERT_SECRET_ARN="${8:-}"
SSL_KEY_SECRET_ARN="${9:-}"

# Use Python to properly handle JSON manipulation
python3 <<EOF
import json
import sys

# Read the template
with open('$TASK_DEF_TEMPLATE', 'r') as f:
    task_def = json.load(f)

# Replace placeholders
def replace_in_dict(d, replacements):
    if isinstance(d, dict):
        return {k: replace_in_dict(v, replacements) for k, v in d.items()}
    elif isinstance(d, list):
        return [replace_in_dict(item, replacements) for item in d]
    elif isinstance(d, str):
        result = d
        for old, new in replacements.items():
            result = result.replace(old, new)
        return result
    else:
        return d

replacements = {
    'REPLACE_WITH_TASK_EXECUTION_ROLE_ARN': '$TASK_EXECUTION_ROLE_ARN',
    'REPLACE_WITH_TASK_ROLE_ARN': '$TASK_ROLE_ARN',
    'REPLACE_WITH_ECR_IMAGE_URI': '$ECR_IMAGE_URI',
    'REPLACE_WITH_SECRETS_MANAGER_ARN': '$SECRET_ARN',
    'REPLACE_WITH_CORS_ORIGIN': '$CORS_ORIGINS',
}

task_def = replace_in_dict(task_def, replacements)

# Handle SSL certificates
container_def = task_def['containerDefinitions'][0]
secrets = container_def.get('secrets', [])

if '$SSL_CERT_SECRET_ARN' and '$SSL_KEY_SECRET_ARN':
    # Add or update SSL certificate secrets
    ssl_cert_found = False
    ssl_key_found = False
    
    for secret in secrets:
        if secret.get('name') == 'SSL_CERT_CONTENT':
            secret['valueFrom'] = '$SSL_CERT_SECRET_ARN'
            ssl_cert_found = True
        elif secret.get('name') == 'SSL_KEY_CONTENT':
            secret['valueFrom'] = '$SSL_KEY_SECRET_ARN'
            ssl_key_found = True
    
    if not ssl_cert_found:
        secrets.append({
            'name': 'SSL_CERT_CONTENT',
            'valueFrom': '$SSL_CERT_SECRET_ARN'
        })
    
    if not ssl_key_found:
        secrets.append({
            'name': 'SSL_KEY_CONTENT',
            'valueFrom': '$SSL_KEY_SECRET_ARN'
        })
else:
    # Remove SSL certificate secrets if not configured
    secrets = [s for s in secrets if s.get('name') not in ['SSL_CERT_CONTENT', 'SSL_KEY_CONTENT']]

container_def['secrets'] = secrets

# Write the output
with open('$TASK_DEF_OUTPUT', 'w') as f:
    json.dump(task_def, f, indent=2)

EOF
