#!/bin/bash
# Universal BudgetPulse installer for macOS, Linux, and Windows (Git Bash/WSL)
# Usage: curl -fsSL https://raw.githubusercontent.com/shrijitb/budget-pulse/main/install.sh | bash

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

echo -e "${BLUE}One-Shot Installer${NC}\n"

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ $1 is not installed${NC}"
    case "$1" in
      git)
        echo "  Install from: https://git-scm.com"
        ;;
      node)
        echo "  Install from: https://nodejs.org"
        ;;
    esac
    return 1
  fi
  echo -e "${GREEN}✓ $1$(command -v $1 | xargs -I {} sh -c 'echo -n " at " && {} --version | head -1')${NC}"
  return 0
}

check_cmd git || exit 1
check_cmd node || exit 1
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  PLATFORM="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  PLATFORM="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  PLATFORM="windows"
else
  PLATFORM="unknown"
fi

echo -e "${BLUE}Detected platform: $PLATFORM${NC}\n"

# Setup paths
INSTALL_DIR="${INSTALL_DIR:-$HOME/BudgetPulse}"
REPO_URL="https://github.com/shrijitb/budget-pulse.git"

# Check if directory exists
if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}Directory $INSTALL_DIR already exists${NC}"
  read -p "Overwrite? (y/N): " -n 1 -r REPLY
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Exiting..."
    exit 0
  fi
  rm -rf "$INSTALL_DIR"
fi

# Clone repository
echo -e "\n${YELLOW}[1/4] Cloning repository...${NC}"
git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Install dependencies
echo -e "\n${YELLOW}[2/4] Installing npm dependencies...${NC}"
npm install --legacy-peer-deps 2>&1 | tail -5

# Build for platform
echo -e "\n${YELLOW}[3/4] Building for $PLATFORM...${NC}"

case "$PLATFORM" in
  linux)
    npm run build:linux
    ARTIFACT=$(ls -1 dist/*.AppImage 2>/dev/null | head -1)
    echo -e "\n${GREEN}✓ Build complete!${NC}"
    echo -e "\n${BLUE}📦 Package created:${NC}"
    echo -e "   $(basename $ARTIFACT) ($(du -h $ARTIFACT | cut -f1))"
    echo -e "\n${BLUE}To run:${NC}"
    echo -e "   chmod +x $ARTIFACT"
    echo -e "   $ARTIFACT"
    echo -e "\n${BLUE}To install system-wide (optional):${NC}"
    echo -e "   sudo mv $ARTIFACT /opt/budgetpulse"
    echo -e "   /opt/budgetpulse"
    ;;
  macos)
    npm run build:mac
    ARTIFACT=$(ls -1 dist/*.dmg 2>/dev/null | head -1)
    echo -e "\n${GREEN}✓ Build complete!${NC}"
    echo -e "\n${BLUE}📦 Package created:${NC}"
    echo -e "   $(basename $ARTIFACT) ($(du -h $ARTIFACT | cut -f1))"
    echo -e "\n${BLUE}To install:${NC}"
    echo -e "   open $ARTIFACT"
    echo -e "   Then drag BudgetPulse to /Applications"
    ;;
  windows)
    npm run build:win
    ARTIFACT=$(ls -1 dist/*.exe 2>/dev/null | head -1)
    echo -e "\n${GREEN}✓ Build complete!${NC}"
    echo -e "\n${BLUE}📦 Package created:${NC}"
    echo -e "   $(basename $ARTIFACT)"
    echo -e "\n${BLUE}To install:${NC}"
    echo -e "   Double-click: $ARTIFACT"
    ;;
  *)
    npm run build
    echo -e "\n${YELLOW}⚠ Unknown platform. Running generic build.${NC}"
    echo -e "${BLUE}For platform-specific builds, run:${NC}"
    echo -e "   npm run build:linux"
    echo -e "   npm run build:mac"
    echo -e "   npm run build:win"
    ;;
esac

echo -e "\n${YELLOW}[4/4] Installation complete!${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo -e "  • Check dist/ folder for your platform's package"
echo -e "  • For development: cd $INSTALL_DIR && npm run dev"
echo -e ""
echo -e "${BLUE}Documentation:${NC}"
echo -e "  https://github.com/shrijitb/budget-pulse"
echo -e ""
