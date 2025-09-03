# Contributing to SF Deployer

Thank you for your interest in contributing! SF Deployer welcomes contributions from the Salesforce development community.

## 🚀 How to Contribute

### Reporting Issues

- Check [existing issues](https://github.com/Jdichiera/sf-deployer/issues) first
- Use the provided issue templates
- Include VS Code version, Salesforce CLI version, and clear reproduction steps

### Suggesting Features

- Open a [feature request](https://github.com/Jdichiera/sf-deployer/issues/new)
- Describe your use case and why the feature would be valuable
- Keep scope focused and well-defined

### Code Contributions

#### Before You Start

- **Discuss major changes** in an issue first
- **Keep PRs focused** - one feature or fix per PR
- **Follow existing code style** - we use ESLint and Prettier

#### Development Setup

1. Fork and clone the repository
2. `cd sf-deployer`
3. `npm install`
4. `npm run build` - ensure everything works
5. Make your changes
6. `npm run test` - run tests
7. `npm run lint` - check code style

#### Pull Request Process

1. **Branch naming:** `feature/description` or `fix/issue-number`
2. **Commit messages:** Clear, descriptive commits
3. **Testing:** Add tests for new features
4. **Documentation:** Update README if needed
5. **PR description:** Explain what changed and why

## 🎯 Contribution Guidelines

### What We're Looking For

- **Bug fixes** with clear reproduction cases
- **Performance improvements** with benchmarks
- **New deployment features** that fit the existing UI paradigm
- **Better error handling** and user feedback
- **Documentation** improvements and examples
- **Test coverage** additions

### Code Standards

- **TypeScript** - All code must be properly typed
- **ESLint/Prettier** - Run `npm run format` before committing
- **Tests** - Add Jest tests for new functionality
- **Backwards compatibility** - Don't break existing workflows

### Review Process

1. All PRs require maintainer review
2. Automated checks must pass (linting, tests, build)
3. Changes may be requested for code style or approach
4. Once approved, maintainer will merge

## 🛠️ Development Tips

### Testing Your Changes

- Test with different Salesforce project structures
- Verify deployment commands work correctly
- Test both success and error scenarios
- Check VS Code console for errors

### Extension Architecture

- `src/extension.ts` - Main extension entry point
- `src/manifestBuilder.ts` - Package.xml generation logic
- `src/tree/fileExplorer.ts` - File tree UI component
- `media/` - Webview picker interface

## 📞 Questions?

- **General questions:** Open a [discussion issue](https://github.com/Jdichiera/sf-deployer/issues)
- **Code questions:** Comment on relevant PRs or issues
- **Private matters:** Reach out via [GitHub](https://github.com/Jdichiera)

## 📜 Code of Conduct

- **Be respectful** - Professional, inclusive communication
- **Be collaborative** - Help others learn and contribute
- **Be patient** - Reviews take time, questions are welcome
- **Be constructive** - Focus on improving the codebase

---

_By contributing, you agree that your contributions will be licensed under the MIT License._
