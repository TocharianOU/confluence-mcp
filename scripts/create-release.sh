#!/bin/bash
set -e
PACKAGE_NAME="confluence-mcp"
VERSION=$(node -p "require('./package.json').version")
RELEASE_TAG="v${VERSION}"
TARBALL="${PACKAGE_NAME}-${RELEASE_TAG}.tar.gz"

echo "Building ${PACKAGE_NAME}@${VERSION}..."
npm run build

echo "Creating tarball: ${TARBALL}"
tar --exclude='.git' \
    --exclude='*.tar.gz' --exclude='*.sha256' --exclude='*.sha512' \
    --exclude='release-tmp' --exclude='.env' \
    -czf "${TARBALL}" \
    index.ts confluence-tools.ts src/ dist/ logos/ node_modules/ \
    package.json package-lock.json tsconfig.json server.json \
    .env.example .nvmrc .prettierrc .gitignore \
    LICENSE NOTICE scripts/

echo "Generating checksums..."
shasum -a 256 "${TARBALL}" > "${TARBALL}.sha256"
shasum -a 512 "${TARBALL}" > "${TARBALL}.sha512"
echo "Done: ${TARBALL}"
cat "${TARBALL}.sha256"
