#needs Xcode 16 or newer, which means MacOS 15 or newer as of 2026

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node
npm install
brew install cocoapods

cd ios/App
pod install
