# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-18

### Added

- Initial release of SF Deployer
- Interactive file picker for selecting Salesforce metadata to deploy
- Automatic package.xml manifest generation
- Support for Deploy Preview, Validate Deploy, and Deploy actions
- Automatic detection of Apex test classes
- Integration with Salesforce CLI (`sf`) commands
- Real-time output streaming to VS Code OUTPUT panel
- Support for all standard Salesforce metadata types

### Features

- **Visual File Selection**: Interactive tree view for selecting files and folders
- **Intelligent Test Detection**: Automatically detects `*Test.cls` files and `@IsTest` annotations
- **Manifest Generation**: Instant package.xml generation based on selected items
- **CLI Integration**: Seamless integration with Salesforce CLI
- **Multiple Deploy Modes**: Preview, Validate, and Deploy options
- **Output Streaming**: Real-time command output in VS Code

### Technical Details

- Requires VS Code 1.85.0 or higher
- Requires Salesforce CLI (`sf`) on PATH
- Built with TypeScript and Webpack
- Comprehensive test suite with Jest
