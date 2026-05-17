#!/bin/bash
# BudgetPulse installer for private repo
# Downloads latest pre-built release without authentication

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}"
cat << "EOF"
 ___         _            _     _____       _
|  _ \      | |          | |   |  __ \     | |
| |_) |_   _| | __ _ ___| |_  | |__) |   _| | ___  ___
|  _ <| | | | |/ _` / __| __| |  ___/ | | | |/ __|/ _ \
| |_) | |_| | | (_| \__ \ |_  | |   | |_| | |\__ \  __/
|____/ \__,_|_|\__, |___/\__| |_|    \__,_|_||___/\___|
                 __/ |
                |___/
EOF
echo -e "${NC}"

echo -e "${BLUE}One-Shot Installer (Private Repo)${NC}\n"

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  PLATFORM="linux"
  ASSET_PATTERN="*.AppImage"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  PLATFORM="macos"
  ASSET_PATTERN="*.dmg"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  PLATFORM="windows"
  ASSET_PATTERN="*.exe"
else
  echo -e "${RED}Unsupported OS${NC}"
  exit 1
fi

echo -e "${BLUE}Detected: $PLATFORM${NC}\n"

# Get latest release
echo -e "${YELLOW}Fetching latest release...${NC}"
RELEASES_URL="https://api.github.com/repos/shrijitb/budget-pulse/releases/latest"
RELEASE_JSON=$(curl -fsSL "$RELEASES_URL")

ASSET_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url": "[^"]*'"$ASSET_PATTERN"'[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ASSET_URL" ]; then
  echo -e "${RED}No release found for $PLATFORM${NC}"
  echo -e "${YELLOW}Make sure a release with $ASSET_PATTERN is published${NC}"
  exit 1
fi

FILENAME=$(basename "$ASSET_URL")
INSTALL_DIR="$HOME/BudgetPulse"
mkdir -p "$INSTALL_DIR"

echo -e "${YELLOW}Downloading $FILENAME...${NC}"
curl -fsSL -o "$INSTALL_DIR/$FILENAME" "$ASSET_URL"

echo -e "${GREEN}✓ Download complete${NC}\n"

case "$PLATFORM" in
  linux)
    chmod +x "$INSTALL_DIR/$FILENAME"
    echo -e "${BLUE}To run:${NC}"
    echo -e "  $INSTALL_DIR/$FILENAME"
    ;;
  macos)
    echo -e "${BLUE}To install:${NC}"
    echo -e "  open $INSTALL_DIR/$FILENAME"
    echo -e "  Then drag BudgetPulse to /Applications"
    ;;
  windows)
    echo -e "${BLUE}To install:${NC}"
    echo -e "  $INSTALL_DIR\\$FILENAME"
    ;;
esac

echo -e "\n${GREEN}✓ BudgetPulse installed!${NC}"
