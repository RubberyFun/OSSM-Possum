#!/bin/sh
pwd
ls -la
cd ../../..
pwd
ls -la
brew install node
brew install cocoapods
npm install
npm run build
npx cap copy ios
