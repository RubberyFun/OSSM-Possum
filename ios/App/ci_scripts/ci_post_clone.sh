#!/bin/sh
brew install node
npm install
brew install cocoapods

npm run build
npx cap copy ios
