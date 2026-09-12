const fs = require('fs');
const path = require('path');
const {
  createRunOncePlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-timefit-live-activity';
const PLUGIN_VERSION = '1.0.0';
const TARGET_NAME = 'TimeFitLiveActivityExtension';
const DEPLOYMENT_TARGET = '17.0';
const TEMPLATE_ROOT = path.join(__dirname, 'live-activity');
const EXTENSION_FILES = [
  'TimeFitLearningEvidence.swift',
  'TimeFitActivityAttributes.swift',
  'TimeFitLiveActivityDiagnostics.swift',
  'TimeFitDiagnosticFileOrder.swift',
  'PrivacyInfo.xcprivacy',
  'TimeFitNativeProgressPolicy.swift',
  'TimeFitNativeIntentPolicy.swift',
  'TimeFitLiveActivityIntents.swift',
  'TimeFitLiveActivityExtension.swift',
  `${TARGET_NAME}-Info.plist`,
  `${TARGET_NAME}.entitlements`,
];
const APP_FILES = [
  'TimeFitActivityAttributes.swift',
  'TimeFitDiagnosticFileOrder.swift',
  'TimeFitLearningEvidence.swift',
  'TimeFitLiveActivityDiagnostics.swift',
  'TimeFitNativeProgressPolicy.swift',
  'TimeFitNativeIntentPolicy.swift',
  'TimeFitLiveActivityIntents.swift',
  'TimeFitLiveActivityModule.swift',
  'TimeFitLiveActivityModuleBridge.m',
];

function assertOptions(options) {
  for (const key of ['appGroupIdentifier', 'developmentTeam', 'extensionBundleIdentifier']) {
    if (typeof options[key] !== 'string' || options[key].trim().length === 0) {
      throw new Error(`${PLUGIN_NAME}: ${key} must be an actual registered project value`);
    }
  }
  if (!options.appGroupIdentifier.startsWith('group.')) {
    throw new Error(`${PLUGIN_NAME}: appGroupIdentifier must start with group.`);
  }
}

function copyNativeFiles(platformProjectRoot, options, projectName) {
  const extensionRoot = path.join(platformProjectRoot, TARGET_NAME);
  fs.mkdirSync(extensionRoot, { recursive: true });
  for (const filename of EXTENSION_FILES) {
    const source = fs.readFileSync(path.join(TEMPLATE_ROOT, filename), 'utf8')
      .replaceAll('__APP_GROUP_IDENTIFIER__', options.appGroupIdentifier);
    fs.writeFileSync(path.join(extensionRoot, filename), source);
  }
  for (const filename of APP_FILES) {
    const source = fs.readFileSync(path.join(TEMPLATE_ROOT, filename), 'utf8')
      .replaceAll('__APP_GROUP_IDENTIFIER__', options.appGroupIdentifier);
    fs.writeFileSync(path.join(platformProjectRoot, projectName, filename), source);
  }
}

function nonCommentEntries(section) {
  return Object.entries(section).filter(([key]) => !key.endsWith('_comment'));
}

function unquote(value) {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
}

function findNativeTarget(project, name) {
  return nonCommentEntries(project.pbxNativeTargetSection())
    .find(([, target]) => unquote(target.name) === name) || null;
}

function removeUndefined(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
    else removeUndefined(value[key]);
  }
}

function buildConfigurationsForTarget(project, target) {
  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  const configurations = project.pbxXCBuildConfigurationSection();
  return list.buildConfigurations.map(({ value }) => configurations[value]);
}

function ensureGroup(project, name) {
  const existing = project.findPBXGroupKey({ name });
  if (existing) return existing;
  const groupKey = project.pbxCreateGroup(name, name);
  project.getPBXGroupByKey(project.getFirstProject().firstProject.mainGroup).children.push({ value: groupKey, comment: name });
  return groupKey;
}

function addSourceOnce(project, pathValue, targetUuid, groupKey) {
  const existing = project.hasFile(pathValue);
  if (existing) return;
  project.addSourceFile(pathValue, { target: targetUuid }, groupKey);
}

function configureProject(project, options, projectName) {
  for (const [, phase] of nonCommentEntries(project.hash.project.objects.PBXShellScriptBuildPhase || {})) {
    if (unquote(phase.name) !== 'Bundle React Native code and images') continue;
    let script = JSON.parse(phase.shellScript);
    const marker = '# TimeFit public archive environment guard';
    if (!script.includes(marker)) {
      const index = script.lastIndexOf('\n`"$NODE_BINARY"');
      if (index < 0) throw new Error('public_bundle_phase_boundary_missing');
      const guard = '\n' + marker + '\nif [[ "$TIMEFIT_BUILD_PROFILE" = "public" ]]; then\n  "$NODE_BINARY" "$PROJECT_ROOT/scripts/release-build.cjs" assert-native || exit 1\nfi\n';
      script = script.slice(0, index) + guard + script.slice(index);
      phase.shellScript = JSON.stringify(script);
    }
  }
  for (const [, configuration] of nonCommentEntries(project.pbxXCBuildConfigurationSection())) {
    if (configuration.buildSettings) configuration.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
  }

  const appTarget = project.getFirstTarget();
  const mainConfigurations = buildConfigurationsForTarget(project, appTarget.firstTarget);
  for (const configuration of mainConfigurations) {
    Object.assign(configuration.buildSettings, {
      TARGETED_DEVICE_FAMILY: '1',
      MARKETING_VERSION: options.version || '1.0.0',
      CURRENT_PROJECT_VERSION: options.buildNumber || '1',
    });
  }
  const appGroupKey = project.findPBXGroupKey({ name: projectName });
  if (!appGroupKey) throw new Error(`${PLUGIN_NAME}: cannot find app source group ${projectName}`);
  addSourceOnce(project, `${projectName}/TimeFitLiveActivityModule.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitActivityAttributes.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitLearningEvidence.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitLiveActivityDiagnostics.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitDiagnosticFileOrder.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitNativeProgressPolicy.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitNativeIntentPolicy.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitLiveActivityIntents.swift`, appTarget.uuid, appGroupKey);
  addSourceOnce(project, `${projectName}/TimeFitLiveActivityModuleBridge.m`, appTarget.uuid, appGroupKey);

  const existingTarget = findNativeTarget(project, TARGET_NAME);
  let extensionUuid = existingTarget?.[0];
  let extensionTarget = existingTarget?.[1] || null;
  if (!extensionTarget) {
    const added = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, options.extensionBundleIdentifier);
    extensionUuid = added.uuid;
    extensionTarget = added.pbxNativeTarget;
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', extensionUuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', extensionUuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', extensionUuid);
    project.addTargetDependency(appTarget.uuid, [extensionUuid]);
  }

  const extensionGroupKey = ensureGroup(project, TARGET_NAME);
  addSourceOnce(project, 'TimeFitActivityAttributes.swift', extensionUuid, extensionGroupKey);
  addSourceOnce(project, 'TimeFitLearningEvidence.swift', extensionUuid, extensionGroupKey);
  addSourceOnce(project, 'TimeFitLiveActivityDiagnostics.swift', extensionUuid, extensionGroupKey);
  addSourceOnce(project, 'TimeFitDiagnosticFileOrder.swift', extensionUuid, extensionGroupKey);
  // Full path avoids colliding with the main target's same-named resource.
  if (!project.hasFile(`${TARGET_NAME}/PrivacyInfo.xcprivacy`)) {
    let resources = project.findPBXGroupKey({ name: 'Resources' });
    if (!resources) {
      resources = project.addPbxGroup([], 'Resources').uuid;
      project.getPBXGroupByKey(project.getFirstProject().firstProject.mainGroup).children.push({ value: resources, comment: 'Resources' });
    }
    project.addResourceFile(`${TARGET_NAME}/PrivacyInfo.xcprivacy`, { target: extensionUuid }, resources);
  }
  addSourceOnce(project, 'TimeFitNativeProgressPolicy.swift', extensionUuid, extensionGroupKey);
  addSourceOnce(project, 'TimeFitNativeIntentPolicy.swift', extensionUuid, extensionGroupKey);
  addSourceOnce(project, 'TimeFitLiveActivityIntents.swift', extensionUuid, extensionGroupKey);
  addSourceOnce(project, 'TimeFitLiveActivityExtension.swift', extensionUuid, extensionGroupKey);

  for (const configuration of buildConfigurationsForTarget(project, extensionTarget)) {
    Object.assign(configuration.buildSettings, {
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      CODE_SIGN_ENTITLEMENTS: `${TARGET_NAME}/${TARGET_NAME}.entitlements`,
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: options.buildNumber || '1',
      DEVELOPMENT_TEAM: options.developmentTeam,
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `${TARGET_NAME}/${TARGET_NAME}-Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
      MARKETING_VERSION: options.version || '1.0.0',
      PRODUCT_BUNDLE_IDENTIFIER: options.extensionBundleIdentifier,
      PRODUCT_NAME: '"$(TARGET_NAME)"',
      SKIP_INSTALL: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '1',
    });
  }

  const projectObject = project.getFirstProject().firstProject;
  projectObject.attributes.TargetAttributes ||= {};
  projectObject.attributes.TargetAttributes[extensionUuid] = {
    CreatedOnToolsVersion: '16.0',
    ProvisioningStyle: 'Automatic',
  };
  removeUndefined(project.hash.project);
  return project;
}

function withTimeFitLiveActivity(config, options = {}) {
  assertOptions(options);
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSSupportsLiveActivities = true;
    return mod;
  });
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.security.application-groups'] = [options.appGroupIdentifier];
    delete mod.modResults['aps-environment'];
    return mod;
  });
  config = withDangerousMod(config, ['ios', async (mod) => {
    const projectName = mod.modRequest.projectName || config.name;
    copyNativeFiles(mod.modRequest.platformProjectRoot, options, projectName);
    return mod;
  }]);
  config = withXcodeProject(config, (mod) => {
    mod = IOSConfig.PrivacyInfo.setPrivacyInfo(mod, {
      NSPrivacyAccessedAPITypes: [{ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] }],
    });
    const projectName = mod.modRequest.projectName || config.name;
    mod.modResults = configureProject(mod.modResults, { ...options, version: config.version, buildNumber: config.ios?.buildNumber }, projectName);
    return mod;
  });
  return config;
}

module.exports = createRunOncePlugin(withTimeFitLiveActivity, PLUGIN_NAME, PLUGIN_VERSION);
module.exports.configureProject = configureProject;
