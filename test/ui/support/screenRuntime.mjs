import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute production TSX/event handlers with deterministic native/port boundaries.
// This is a hook host, not Yoga or an iOS renderer; native layout is injected explicitly.
export function screenRuntime(overrides = {}) {
  const instances = new Map(), instanceTypes = new Map(), modules = new Map(), effects = [];
  let current, cursor, dirty = false, tree;
  const element = (type, props, key) => ({ type, props: props ?? {}, key });
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    Fragment: 'Fragment',
    useState(initial) { const slots = current, i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (next) => { const value = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return current[i] ??= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!depsEqual(current[i]?.deps, deps)) current[i] = { value: fn(), deps }; return current[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const slots = current, i = cursor++; if (!depsEqual(slots[i]?.deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const native = { View: 'View', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' }, Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) }, StyleSheet: { create: v => v, absoluteFillObject: {} }, useWindowDimensions: () => ({ width: 320, height: 568, fontScale: 2 }), Linking: {}, Alert: { alert() {} }, AppState: { addEventListener: () => ({ remove() {} }) } };
  const defaults = { react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' }, 'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 16, left: 0, right: 0 }) }, 'expo-web-browser': {}, './AnimatedPressable': { AnimatedPressable: 'Pressable' }, '../AnimatedPressable': { AnimatedPressable: 'Pressable' }, './KakaoRouteMap': { KakaoRouteMap: 'KakaoRouteMap' } };
  // Deterministic native animation boundary: no timers or real accessibility service.
  native.AccessibilityInfo = { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) };
  native.Animated = { View: 'AnimatedView', Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} }, timing: () => ({}), sequence: () => ({}), loop: () => ({ start() {}, stop() {} }) };
  function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const mod = { exports: {} }; modules.set(file, mod);
    const req = createRequire(file);
    const localRequire = id => {
      if (id in overrides) return overrides[id];
      if (id === './MapCameraButton') return { MapCameraButton: 'MapCameraButton' };
      if (id in defaults) return defaults[id];
      const resolved = req.resolve(id);
      return resolved.endsWith('.tsx') ? load(resolved) : req(id);
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', 'requestAnimationFrame', 'process', '__DEV__', 'Date', code)(localRequire, mod, mod.exports, fn => fn(), overrides.__process ?? process, overrides.__DEV__, overrides.__Date ?? Date);
    return mod.exports;
  }
  function expand(node, key = 'root') {
    if (Array.isArray(node)) return node.flatMap((v, i) => expand(v, `${key}/${v?.key ?? i}`));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      // React remounts a different component type/key at the same tree position.
      const identity = instanceTypes.get(key);
      if (identity && (identity.type !== node.type || identity.key !== node.key)) {
        for (const [childKey, slots] of instances) {
          if (childKey === key || childKey.startsWith(`${key}/`)) {
            slots.forEach(slot => slot?.cleanup?.()); instances.delete(childKey); instanceTypes.delete(childKey);
          }
        }
      }
      instanceTypes.set(key, { type: node.type, key: node.key });
      current = instances.get(key) ?? []; instances.set(key, current); cursor = 0;
      return expand(node.type(node.props), `${key}/render`);
    }
    return { ...node, props: { ...node.props, children: expand(node.props.children, `${key}/children`) } };
  }
  return {
    react,
    native,
    load,
    mount(Component, props) {
      const screen = { render() { let attempts = 0; do { dirty = false; tree = expand(element(Component, props)); effects.splice(0).forEach(fn => fn()); if (++attempts > 20) throw Error('render loop'); } while (dirty); return tree; }, nodes(predicate) { const found = []; const walk = n => { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; if (predicate(n)) found.push(n); walk(n.props.children); }; walk(screen.render()); return found; }, get(id) { const n = screen.nodes(n => n.props.testID === id)[0]; if (!n) throw Error(`missing testID: ${id}`); return n; }, press(id) { const n = screen.get(id); if (!n.props.disabled) return n.props.onPress(); }, unmount() { instances.forEach(slots => slots.forEach(s => s?.cleanup?.())); instances.clear(); } };
      screen.render(); return screen;
    },
  };
}
