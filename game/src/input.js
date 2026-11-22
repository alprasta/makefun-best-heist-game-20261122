// Keyboard + mouse input for Gilded Midnight. The game reads movement from
// WASD or the arrow keys, Shift to sneak, E (held) to hack a console, and a
// mouse click to toss a decoy coin toward the cursor.

export function createInput(canvas) {
  const keys = new Set();
  let click = null;

  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };
  const up = (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const onClick = (e) => {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('click', onClick);

  return {
    // -1..1 movement vector from the keys held down right now.
    move() {
      let dx = 0;
      let dy = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) dx += 1;
      if (keys.has('w') || keys.has('ArrowUp')) dy -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) dy += 1;
      return { dx, dy };
    },
    sneak() {
      return keys.has('Shift');
    },
    hackHeld() {
      return keys.has('e');
    },
    pressed(key) {
      return keys.has(key);
    },
    // One queued click, consumed on read.
    takeClick() {
      const c = click;
      click = null;
      return c;
    },
  };
}
