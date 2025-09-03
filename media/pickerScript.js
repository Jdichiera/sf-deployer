(function () {
  const vscode = acquireVsCodeApi();
  console.log('SF Deployer picker script loaded');
  function log(m) {
    console.log('[Picker]', m);
  }
  function emojiFor(name, fullPath) {
    if (name.endsWith('.cls')) return '🧩';
    if (name.endsWith('.trigger')) return '⚡';
    if (name.endsWith('.page')) return '📄';
    if (name.endsWith('.layout-meta.xml')) return '📐';
    if (name.endsWith('.flexipage-meta.xml')) return '🗔';
    if (name.endsWith('.tab-meta.xml')) return '🔖';
    if (name.endsWith('.object-meta.xml')) return '📦';
    if (name.endsWith('.profile-meta.xml')) return '👤';
    if (name.endsWith('.flow') || name.endsWith('.flow-meta.xml')) return '➡️';
    if (
      name.endsWith('.js-meta.xml') &&
      fullPath.replace(/\\/g, '/').includes('/lwc/')
    )
      return '⚡️‍💻';
    return '📄';
  }
  function relative(p) {
    const idx = p.indexOf('/force-app/');
    return idx >= 0 ? p.slice(idx + 1) : p.split(/[/\\]/).slice(-3).join('/');
  }
  // DOM refs
  const cmdPreview = document.getElementById('cmdPreview');
  const treeContainer = document.getElementById('tree');
  const selList = document.getElementById('selList');
  const manifestPane = document.getElementById('manifestPre');
  // Remove the temporary init message once loaded
  const initMsg = document.querySelector('body > p');
  if (initMsg) initMsg.remove();
  const dryRunChk = document.getElementById('dryRun');
  // checkOnly checkbox removed
  const deployBtn = document.getElementById('deployBtn');
  const clearBtn = document.getElementById('clearBtn');
  const filterInput = document.getElementById('filterInput');

  // Named manifest controls (may not exist in test environment)
  const manifestNameInput = document.getElementById('manifestName');
  const saveManifestBtn = document.getElementById('saveManifestBtn');
  const manifestDropdown = document.getElementById('manifestDropdown');
  const loadManifestBtn = document.getElementById('loadManifestBtn');

  const allowedFolders = [
    'classes',
    'flexiPages',
    'flexipages',
    'flows',
    'layouts',
    'lwc',
    'objects',
    'pages',
    'permissionsetgroups',
    'permissionsets',
    'profiles',
    'tabs',
    'triggers',
  ];
  // File extensions that are not deployable and should be hidden from the picker
  const nonDeployableExts = ['.txt', '.md', '.log'];

  function buildCmd() {
    let cmd = 'sf project deploy start --manifest <package.xml> --verbose';
    if (dryRunChk && dryRunChk.checked) cmd += ' --dry-run';

    const testLevelElement = document.querySelector(
      'input[name="testLevel"]:checked'
    );
    if (!testLevelElement) return cmd; // Return basic command if no test level element exists

    const tl = testLevelElement.value;
    if (tl === 'none') cmd += ' --test-level NoTestRun';
    else if (tl === 'all') cmd += ' --test-level RunLocalTests';
    else if (tl === 'specified') {
      const tests = Array.from(
        document.querySelectorAll('input[data-leaf="true"]:checked')
      )
        .map((cb) => cb.getAttribute('data-path'))
        .filter((p) => p.endsWith('Test.cls'))
        .map((p) => p.replace(/.*\/(.+)\.cls$/, '$1'));
      if (tests.length)
        cmd += ' --test-level RunSpecifiedTests --tests ' + tests.join(' ');
      else cmd += ' --test-level RunSpecifiedTests --tests <none>'; // placeholder
    }
    return cmd;
  }

  function updateCmdPreview() {
    if (cmdPreview) cmdPreview.innerText = buildCmd();
  }

  function resetPickerFlags() {
    // Reset dry-run checkbox to unchecked
    if (dryRunChk) {
      dryRunChk.checked = false;
    }

    // Reset test level to "none" (default)
    const testLevelRadios = document.querySelectorAll(
      'input[name="testLevel"]'
    );
    testLevelRadios.forEach((radio) => {
      radio.checked = radio.value === 'none';
    });

    // Update the command preview to reflect the reset flags (only if cmdPreview exists)
    if (cmdPreview) {
      updateCmdPreview();
    }
    log('Picker flags reset to default state');
  }

  // ---------- Tree Rendering ----------
  function renderTree(nodes, selectedArr) {
    const selected = new Set(selectedArr);
    treeContainer.innerHTML = '';
    const ul = document.createElement('ul');

    const topLevelNodesToRender = nodes.filter((node) => {
      const nodeNameLower = node.name.toLowerCase();
      return (
        ['default', 'main'].includes(nodeNameLower) ||
        allowedFolders.includes(nodeNameLower)
      );
    });

    topLevelNodesToRender.forEach((node) => {
      buildTreeNodes([node], ul, selected, node.name.toLowerCase()); // Pass node.name as parentName
    });

    treeContainer.appendChild(ul);
    updateSelectedList(selected);
  }

  function buildTreeNodes(nodes, parentUl, selected, parentName) {
    nodes.forEach((n) => {
      const parentNameLower = parentName ? parentName.toLowerCase() : null;
      const li = document.createElement('li');
      // Determine if the current node (folder) should be displayed
      let shouldDisplayCurrentFolder = true;
      if (n.children && n.children.length) {
        // It's a folder
        const currentFolderName = n.name.toLowerCase();
        const parentNameLower = parentName ? parentName.toLowerCase() : null;

        if (parentNameLower === 'default') {
          // If parent is 'default', only display if current folder is in allowedFolders
          shouldDisplayCurrentFolder =
            allowedFolders.includes(currentFolderName);
        }
        // For all other parent names, shouldDisplayCurrentFolder remains true
      }

      if (!shouldDisplayCurrentFolder) {
        return; // Skip rendering this folder and its subtree
      }

      if (n.children && n.children.length) {
        const details = document.createElement('details');
        details.open = ['default', 'main'].includes(n.name.toLowerCase()); // Automatically expand 'default' and 'main'
        const summary = document.createElement('summary');
        // folder checkbox
        const dirCb = document.createElement('input');
        dirCb.type = 'checkbox';
        // Enable checkbox only for direct sub-folders of "classes".
        const canSelectFolder = parentNameLower === 'classes';
        dirCb.disabled = !canSelectFolder;

        // Checkbox reflects whether every descendant leaf is selected
        dirCb.checked = n.children.every((c) => selected.has(c.path));

        // When user toggles an enabled folder, propagate selection to all descendants
        dirCb.addEventListener('change', () => {
          // Gather all descendant leaf paths once
          const leafInputs = details.querySelectorAll(
            'input[data-leaf="true"]'
          );
          const paths = Array.from(leafInputs).map((cb) => {
            cb.checked = dirCb.checked;
            return cb.getAttribute('data-path');
          });

          vscode.postMessage({
            type: 'bulkSet',
            paths,
            selected: dirCb.checked,
          });

          updateSelectedListFromDom();
        });
        summary.appendChild(dirCb);
        const txt = document.createElement('span');
        txt.textContent = ' 📂 ' + n.name;
        summary.appendChild(txt);
        details.appendChild(summary);
        const childUl = document.createElement('ul');
        details.appendChild(childUl);
        li.appendChild(details);
        parentUl.appendChild(li);
        buildTreeNodes(n.children, childUl, selected, n.name.toLowerCase()); // Recursive call, pass current node's name as parentName
      } else {
        // Skip non-deployable leaf files
        const lowerName = n.name.toLowerCase();
        if (nonDeployableExts.some((ext) => lowerName.endsWith(ext))) {
          return; // do not render
        }
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.leaf = 'true';
        cb.dataset.path = n.path;
        cb.checked = selected.has(n.path);
        cb.addEventListener('change', () => {
          vscode.postMessage({
            type: 'update',
            path: n.path,
            selected: cb.checked,
          });
          updateSelectedListFromDom();
        });
        label.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = `${emojiFor(n.name, n.path)} ${n.name}`;
        label.appendChild(span);
        li.appendChild(label);
        parentUl.appendChild(li);
      }
    });
  }

  function updateSelectedList(selectedSet) {
    selList.innerHTML = '';
    [...selectedSet].forEach((p) => {
      const li = document.createElement('li');
      const remove = document.createElement('span');
      remove.textContent = '✕ ';
      remove.style.color = '#cc0000';
      remove.style.cursor = 'pointer';
      remove.title = 'Remove from selection';
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        const cb = treeContainer.querySelector(`input[data-path="${p}"]`);
        if (cb) cb.checked = false;
        vscode.postMessage({ type: 'update', path: p, selected: false });
        updateSelectedListFromDom();
      });
      const textSpan = document.createElement('span');
      textSpan.textContent = relative(p);
      li.style.cursor = 'pointer';
      li.title = 'Click to locate in tree';
      li.append(remove, textSpan);
      li.addEventListener('click', () => {
        const cb = treeContainer.querySelector(`input[data-path="${p}"]`);
        if (cb) {
          cb.scrollIntoView({ behavior: 'smooth', block: 'center' });
          cb.focus();
        }
      });
      selList.appendChild(li);
    });
  }

  function updateSelectedListFromDom() {
    const chk = treeContainer.querySelectorAll(
      'input[data-leaf="true"]:checked'
    );
    const set = new Set(
      Array.from(chk).map((c) => c.getAttribute('data-path'))
    );
    updateSelectedList(set);
  }

  const state = vscode.getState() || {};

  function saveState() {
    vscode.setState({
      dryRun: dryRunChk.checked,
      // checkOnly removed from state
      testLevel: document.querySelector('input[name="testLevel"]:checked')
        .value,
    });
  }

  // Apply saved state
  if (state.dryRun) dryRunChk.checked = true;
  if (state.testLevel) {
    const rb = document.querySelector(
      `input[name='testLevel'][value='${state.testLevel}']`
    );
    if (rb) rb.checked = true;
  }

  // adjust listeners
  [dryRunChk].forEach((el) => {
    const handler = () => {
      console.log('dryRun change, checked=', dryRunChk.checked);
      saveState();
      updateCmdPreview();
      console.log('preview now', cmdPreview.innerText);
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
  document.querySelectorAll('input[name="testLevel"]').forEach((rb) => {
    const handler = () => {
      console.log('testLevel change');
      saveState();
      updateCmdPreview();
    };
    rb.addEventListener('click', handler);
    rb.addEventListener('input', handler);
  });

  // --- filter ---
  filterInput.addEventListener('input', () => {
    const q = filterInput.value.toLowerCase();
    treeContainer.querySelectorAll('li').forEach((li) => {
      const text = li.textContent.toLowerCase();
      li.style.display = text.includes(q) ? '' : 'none';
    });
  });
  filterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      filterInput.value = '';
      filterInput.dispatchEvent(new Event('input'));
    }
  });

  // initial preview
  updateCmdPreview();

  deployBtn.addEventListener('click', () => {
    const msg = {
      type: 'deploy',
      flags: {
        dryRun: dryRunChk.checked,
        // checkOnly flag removed
        testLevel: document.querySelector('input[name="testLevel"]:checked')
          .value,
      },
    };
    vscode.postMessage(msg);
  });

  clearBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'cleared' });
    treeContainer
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => (cb.checked = false));
    selList.innerHTML = '';
  });

  // --- Named Manifest Controls ---
  // Only add event listeners if the elements exist (they may not exist in test environment)
  if (saveManifestBtn && manifestNameInput) {
    saveManifestBtn.addEventListener('click', () => {
      const manifestName = manifestNameInput.value.trim();
      if (!manifestName) {
        alert('Please enter a manifest name');
        return;
      }
      if (manifestName.includes('/') || manifestName.includes('\\')) {
        alert('Manifest name cannot contain / or \\ characters');
        return;
      }

      vscode.postMessage({
        type: 'saveManifest',
        manifestName: manifestName,
      });

      // Clear the input after saving
      manifestNameInput.value = '';
    });

    // Allow Enter key to save manifest
    manifestNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveManifestBtn.click();
      }
    });
  }

  if (loadManifestBtn && manifestDropdown) {
    loadManifestBtn.addEventListener('click', () => {
      const selectedManifest = manifestDropdown.value;
      if (!selectedManifest) {
        alert('Please select a manifest to load');
        return;
      }

      vscode.postMessage({
        type: 'loadManifest',
        manifestName: selectedManifest,
      });
    });
  }

  // Update the manifest dropdown with available saved manifests
  function updateManifestDropdown(manifests) {
    // Only update if the dropdown element exists
    if (!manifestDropdown) {
      log('Manifest dropdown not found, skipping update');
      return;
    }

    // Clear existing options except the placeholder
    manifestDropdown.innerHTML =
      '<option value="">-- Select saved manifest --</option>';

    // Add manifest options
    manifests.forEach((manifestName) => {
      const option = document.createElement('option');
      option.value = manifestName;
      option.textContent = manifestName;
      manifestDropdown.appendChild(option);
    });

    log(`Updated manifest dropdown with ${manifests.length} manifests`);
  }

  // Update tree checkbox selections without rebuilding the tree
  function updateTreeSelections(selectedPaths) {
    const selectedSet = new Set(selectedPaths);

    // Find all checkboxes in the tree and update their state
    const checkboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      const path = checkbox.dataset.path;
      if (path) {
        checkbox.checked = selectedSet.has(path);
      }
    });

    // Refresh the selected list display
    updateSelectedListFromDom();

    log(
      `Updated ${checkboxes.length} checkboxes, ${selectedPaths.length} selected`
    );
  }

  function parseManifestXML(xmlString) {
    if (!xmlString || xmlString.trim().startsWith('<!--')) {
      return []; // Empty or comment-only manifest
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      const types = xmlDoc.querySelectorAll('types');
      const items = [];

      types.forEach((typeNode) => {
        const typeName = typeNode.querySelector('name')?.textContent;
        const members = typeNode.querySelectorAll('members');

        members.forEach((member) => {
          const memberName = member.textContent;
          if (typeName && memberName) {
            items.push({ type: typeName, name: memberName });
          }
        });
      });

      return items;
    } catch (error) {
      console.error('Failed to parse manifest XML:', error);
      return [];
    }
  }

  function displayInteractiveManifest(xmlString) {
    const items = parseManifestXML(xmlString);

    if (items.length === 0) {
      // Show the original XML for empty manifests or comments
      manifestPre.innerHTML = '';
      manifestPre.textContent = xmlString;
      return;
    }

    // Create interactive XML display
    manifestPre.innerHTML = '';
    manifestPre.style.fontFamily = 'monospace';
    manifestPre.style.fontSize = '12px';
    manifestPre.style.lineHeight = '1.4';

    // XML Declaration
    const xmlDecl = document.createElement('div');
    xmlDecl.classList.add('vscode-disabled-foreground');
    xmlDecl.textContent = '<?xml version="1.0" encoding="UTF-8"?>';
    manifestPre.appendChild(xmlDecl);

    // Package opening tag
    const packageOpen = document.createElement('div');
    packageOpen.classList.add('vscode-disabled-foreground');
    packageOpen.textContent =
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">';
    manifestPre.appendChild(packageOpen);

    // Group items by type for proper XML structure
    const typeGroups = {};
    items.forEach((item) => {
      if (!typeGroups[item.type]) {
        typeGroups[item.type] = [];
      }
      typeGroups[item.type].push(item.name);
    });

    // Display each types section
    Object.entries(typeGroups).forEach(([typeName, members]) => {
      // Types opening tag
      const typesOpen = document.createElement('div');
      typesOpen.classList.add('vscode-disabled-foreground');
      typesOpen.style.marginLeft = '20px';
      typesOpen.textContent = '  <types>';
      manifestPre.appendChild(typesOpen);

      // Members
      members.forEach((memberName) => {
        const memberDiv = document.createElement('div');
        memberDiv.style.marginLeft = '40px';

        const openMembersTag = document.createElement('span');
        openMembersTag.classList.add('vscode-disabled-foreground');
        openMembersTag.textContent = '    <members>';
        memberDiv.appendChild(openMembersTag);

        const memberNameSpan = document.createElement('span');
        memberNameSpan.classList.add('vscode-textlink-foreground');
        memberNameSpan.textContent = escapeHtml(memberName);
        memberDiv.appendChild(memberNameSpan);

        const closeMembersTag = document.createElement('span');
        closeMembersTag.classList.add('vscode-disabled-foreground');
        closeMembersTag.textContent = '</members>';
        memberDiv.appendChild(closeMembersTag);

        manifestPre.appendChild(memberDiv);
      });

      // Name element
      const nameDiv = document.createElement('div');
      nameDiv.classList.add('vscode-disabled-foreground');
      nameDiv.style.marginLeft = '40px';
      nameDiv.textContent = `    <name>${typeName}</name>`;
      manifestPre.appendChild(nameDiv);

      // Types closing tag
      const typesClose = document.createElement('div');
      typesClose.classList.add('vscode-disabled-foreground');
      typesClose.style.marginLeft = '20px';
      typesClose.textContent = '  </types>';
      manifestPre.appendChild(typesClose);
    });

    // Version
    const versionDiv = document.createElement('div');
    versionDiv.classList.add('vscode-disabled-foreground');
    versionDiv.style.marginLeft = '20px';
    versionDiv.textContent = '  <version>60.0</version>';
    manifestPre.appendChild(versionDiv);

    // Package closing tag
    const packageClose = document.createElement('div');
    packageClose.classList.add('vscode-disabled-foreground');
    packageClose.textContent = '</Package>';
    manifestPre.appendChild(packageClose);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function removeManifestItem(typeName, memberName) {
    console.log(`SF Deployer: Removing ${typeName}: ${memberName}`);

    // Find and uncheck the corresponding file in the tree
    let pathToRemove = null;

    // Get all checked items and find the one that corresponds to this manifest item
    const checkedInputs = treeContainer.querySelectorAll(
      'input[data-leaf="true"]:checked'
    );

    checkedInputs.forEach((input) => {
      const filePath = input.getAttribute('data-path');
      const fileName = filePath.split(/[/\\]/).pop();
      const baseName = fileName.replace(
        /\.(cls|trigger|page|object|field|flow|layout|flexipage|tab|profile|group)(-meta)?\.xml?$/,
        ''
      );

      // Match different patterns based on type
      let matches = false;
      if (
        typeName === 'ApexClass' &&
        (fileName.endsWith('.cls') || fileName.endsWith('.cls-meta.xml'))
      ) {
        matches = baseName === memberName;
      } else if (
        typeName === 'ApexTrigger' &&
        (fileName.endsWith('.trigger') ||
          fileName.endsWith('.trigger-meta.xml'))
      ) {
        matches = baseName === memberName;
      } else if (
        typeName === 'CustomObject' &&
        (fileName.endsWith('.object-meta.xml') || fileName.endsWith('.object'))
      ) {
        matches = baseName === memberName;
      } else if (typeName === 'CustomField' && memberName.includes('.')) {
        const [objName, fieldName] = memberName.split('.');
        matches = filePath.includes(`/objects/${objName}/fields/${fieldName}`);
      } else if (
        typeName === 'Flow' &&
        (fileName.endsWith('.flow') || fileName.endsWith('.flow-meta.xml'))
      ) {
        matches = baseName === memberName;
      } else if (
        typeName === 'Layout' &&
        fileName.endsWith('.layout-meta.xml')
      ) {
        matches = baseName.replace('.layout', '') === memberName;
      } else if (
        typeName === 'FlexiPage' &&
        fileName.endsWith('.flexipage-meta.xml')
      ) {
        matches = baseName.replace('.flexipage-meta', '') === memberName;
      } else if (
        typeName === 'LightningComponentBundle' &&
        filePath.includes(`/lwc/${memberName}/`)
      ) {
        matches = true;
      } else if (
        typeName === 'AuraDefinitionBundle' &&
        filePath.includes(`/aura/${memberName}/`)
      ) {
        matches = true;
      }

      if (matches && !pathToRemove) {
        pathToRemove = filePath;
      }
    });

    if (pathToRemove) {
      // Uncheck the item in the tree
      const checkbox = treeContainer.querySelector(
        `input[data-path="${pathToRemove}"]`
      );
      if (checkbox) {
        checkbox.checked = false;
        // Send update message to extension
        vscode.postMessage({
          type: 'update',
          path: pathToRemove,
          selected: false,
        });
        updateSelectedListFromDom();
      }
    }
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'busy') {
      log('busy message received');
      deployBtn.disabled = true;
    } else if (msg.type === 'idle') {
      log('idle message received');
      deployBtn.disabled = false;
    } else if (msg.type === 'init') {
      log('init message received');
      const loading = document.getElementById('loading');
      if (loading) loading.remove();
      renderTree(msg.tree, msg.selected || []);
    } else if (msg.type === 'cleared') {
      treeContainer
        .querySelectorAll('input[type="checkbox"]')
        .forEach((cb) => (cb.checked = false));
      selList.innerHTML = '';
    } else if (msg.type === 'manifest') {
      console.log(
        'SF Deployer: Received manifest xml:',
        (msg.xml || '').slice(0, 80)
      );
      displayInteractiveManifest(msg.xml);
      manifestPre.style.color = ''; // Reset color for normal display
    } else if (msg.type === 'manifestError') {
      console.error('SF Deployer: Manifest error:', msg.error);
      manifestPre.textContent = `Error generating manifest:\n${msg.error}`;
      manifestPre.style.color = '#cc0000';
    } else if (msg.type === 'manifestList') {
      log('Received manifest list:', msg.manifests);
      updateManifestDropdown(msg.manifests);
    } else if (msg.type === 'manifestSaved') {
      log(`Manifest "${msg.manifestName}" saved successfully`);
      // Clear the input field and provide visual feedback
      if (manifestNameInput) {
        manifestNameInput.value = '';
        manifestNameInput.placeholder = 'Manifest name...';
      }
      // Trigger manifest rebuild to ensure preview is current
      updateSelectedListFromDom();
    } else if (msg.type === 'manifestLoaded') {
      const validCount = msg.selections ? msg.selections.length : 0;
      const originalCount = msg.originalSelections
        ? msg.originalSelections.length
        : 0;

      if (msg.hasInvalidPaths) {
        const invalidCount = originalCount - validCount;
        log(
          `Manifest "${msg.manifestName}" loaded with ${validCount}/${originalCount} valid selections (${invalidCount} invalid/missing files skipped)`
        );
      } else {
        log(
          `Manifest "${msg.manifestName}" loaded with ${validCount} selections`
        );
      }
      // Clear the input field and reset dropdown
      if (manifestNameInput) {
        manifestNameInput.value = '';
        manifestNameInput.placeholder = 'Manifest name...';
      }
      if (manifestDropdown) {
        manifestDropdown.value = '';
      }
      // Reset picker flags to default state when loading a manifest
      resetPickerFlags();
      // The selections are already updated in workspaceState by the extension
      // The tree will be refreshed via the broadcastManifest call
    } else if (msg.type === 'updateSelections') {
      log(`Updating picker selections with ${msg.selections.length} items`);
      updateTreeSelections(msg.selections || []);
    }
  });

  // Request initial manifest list when webview loads (only in real webview, not tests)
  // Only call if we have the manifest dropdown element (indicates we're in the real webview)
  if (typeof vscode !== 'undefined' && vscode.postMessage && manifestDropdown) {
    vscode.postMessage({ type: 'requestManifestList' });
  }
})();
