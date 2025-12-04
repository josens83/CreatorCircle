#!/bin/bash
# =============================================================================
# CreatorCircle Database Backup Script
# =============================================================================

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="creatorcircle_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

log "Starting database backup..."

# Create backup
pg_dump -Fc --clean --if-exists | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log "Backup created successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    error "Backup failed!"
    exit 1
fi

# Create latest symlink
ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/latest.sql.gz"

# Upload to S3 (if configured)
if [ -n "${S3_BUCKET}" ]; then
    log "Uploading backup to S3..."
    aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/${BACKUP_FILE}"

    if [ $? -eq 0 ]; then
        log "Backup uploaded to S3 successfully"
    else
        warn "S3 upload failed, local backup retained"
    fi
fi

# Cleanup old backups
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "creatorcircle_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/creatorcircle_backup_*.sql.gz 2>/dev/null | wc -l)
log "Backup complete. ${BACKUP_COUNT} backup(s) retained."

# Verify backup integrity
log "Verifying backup integrity..."
if gzip -t "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null; then
    log "Backup integrity verified"
else
    error "Backup integrity check failed!"
    exit 1
fi

log "Backup process completed successfully"
