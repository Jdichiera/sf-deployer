<p align="center">
  <img src="https://github.com/Jdichiera/sf-deployer/blob/main/images/pallas.png?raw=true" width="128" alt="SF Deployer logo" />
</p>

# SF Deployer

Zero-friction Salesforce deployments from inside VS Code.

![SF Deployer Demo](images/demo.gif)

> **Quick Demo**: Select files → Generate manifest → Deploy to Salesforce - all from within VS Code!

---

## Install

1. Install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=JeramyDichiera.sf-deployer) or download the latest `.vsix` from the [Releases page](https://github.com/Jdichiera/sf-deployer/releases) and install via **… → Install from VSIX**.
2. Make sure you have the Salesforce CLI (`sf`) on your PATH.

## ✨ Features

### **🎯 Single Command Entry Point**

- **F1** / **⌘⇧P** → `SF Deployer: Open Picker` – Everything you need in one place!

### **📁 Interactive File Selection**

- **Visual tree interface** with expandable folders and files
- **Checkbox selection** – click to select/deselect files and folders
- **Smart filtering** – filter files by name or type
- **Real-time feedback** – see your selections update instantly

### **📦 Automatic Manifest Generation**

- **Smart metadata detection** – automatically identifies Salesforce metadata types
- **Real-time XML generation** – creates `package.xml` as you select files
- **Manifest preview** – see generated XML in the picker interface
- **Persistent storage** – saves manifests to `manifests/` folder for reuse

### **🚀 Multiple Deployment Modes**

- **🔍 Deploy Preview** – show what will be deployed (safe preview, no changes applied)
- **✅ Validate Deploy** – run validation and tests without deploying
- **🚀 Deploy** – actual deployment to your Salesforce org

### **🧪 Intelligent Apex Test Integration**

- **Auto-detection** – finds test classes ending with `*Test.cls` or containing `@IsTest`
- **Flexible test levels**:
  - `NoTestRun` – skip all tests
  - `RunLocalTests` – run all tests in org (excluding managed packages)
  - `RunSpecifiedTests` – run only selected test classes
- **Smart test filtering** – automatically includes relevant tests from your selection

### **💾 Named Manifest Management**

- **Save manifests** – name and save your deployment configurations
- **Load manifests** – dropdown to quickly load previously saved manifests
- **Deployment patterns** – reuse common deployment scenarios

### **📺 Real-time Feedback**

- **CLI output streaming** – see Salesforce CLI output in dedicated OUTPUT panel
- **Status indicators** – deployment progress in VS Code status bar
- **Error handling** – clear error messages and troubleshooting guidance

## 🏃‍♂️ Quick Start

1. **Open** a Salesforce DX project in VS Code
2. **Press** **F1** / **⌘⇧P** and run **`SF Deployer: Open Picker`**
3. **Select** files or folders by checking the boxes in the tree view
4. **Watch** the `package.xml` manifest generate automatically
5. **Choose** your deployment action:
   - **Deploy Preview** – safe preview of what will be deployed
   - **Validate Deploy** – run tests and validation only
   - **Deploy** – push your changes live
6. **Monitor** real-time output in the **SF Deployer** OUTPUT panel

## 📋 Supported Metadata Types

SF Deployer supports **14 major Salesforce metadata types**:

### **🧩 Core Development**

- **ApexClass** – Apex classes (`.cls` files)
- **ApexTrigger** – Database triggers (`.trigger` files)
- **ApexPage** – Visualforce pages (`.page` files)
- **ApexTestSuite** – Test suites (`.testSuite-meta.xml` files)

### **⚡ Lightning & Components**

- **LightningComponentBundle** – Lightning Web Components (LWC)
- **AuraDefinitionBundle** – Aura Components

### **🔄 Automation & Logic**

- **Flow** – Process Builder flows (`.flow` and `.flow-meta.xml` files)

### **🎨 UI & Layout**

- **Layout** – Page layouts (`.layout-meta.xml` files)
- **FlexiPage** – Lightning pages (`.flexipage-meta.xml` files)
- **CustomTab** – Custom tabs (`.tab-meta.xml` files)

### **📊 Data & Security**

- **CustomObject** – Custom objects (`.object` and `.object-meta.xml` files)
- **CustomField** – Custom fields (field definitions in `/objects/*/fields/`)
- **Profile** – User profiles (`.profile-meta.xml` files)
- **Group** – Public groups (`.group-meta.xml` files)

## Support & Feedback

### 🐛 Found a Bug?

Please [open an issue](https://github.com/Jdichiera/sf-deployer/issues/new) with:

- VS Code version
- Salesforce CLI version (`sf --version`)
- Steps to reproduce
- Expected vs actual behavior
- Console logs (Help → Toggle Developer Tools → Console)

### 💡 Feature Requests

Have an idea? [Create a feature request](https://github.com/Jdichiera/sf-deployer/issues/new) and describe your use case.

### 📧 Direct Contact

For sensitive issues or questions, reach out via [GitHub](https://github.com/Jdichiera).

## Contributing

Contributions welcome! Please read the [contribution guidelines](https://github.com/Jdichiera/sf-deployer/blob/main/CONTRIBUTING.md) first.

---

©2024 Jeramy — MIT License | [GitHub](https://github.com/Jdichiera/sf-deployer) | [Marketplace](https://marketplace.visualstudio.com/items?itemName=JeramyDichiera.sf-deployer)
