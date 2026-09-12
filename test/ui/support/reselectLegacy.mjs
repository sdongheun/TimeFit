// Exercise the production gate using two fresh picker confirmations, never an old-coordinate approval button.
export async function reselectLegacy(screen, origin, destination = origin) {
  for (const [target, point] of [['origin', origin], ['destination', destination]]) {
    screen.press(`restore-${target}`);
    screen.nodes(n => n.type === 'PlacePicker')[0].props.onConfirm({ ...point, label: target, source: 'provider' });
  }
  screen.press('restore-submit');
  for (let i = 0; i < 20; i++) await Promise.resolve();
  screen.render();
}
