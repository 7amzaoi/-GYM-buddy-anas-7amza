/**
 * Mirrors local app slice to `gymbuddy_app_state.state` for signed-in Supabase users.
 * Dynamic-imports avoid circular deps with store.js.
 */

let mirrorTimer;

export function scheduleCloudMirrorDebounced(delayMs = 1400) {
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => {
    mirrorTimer = undefined;
    void mirrorAppStateOnce();
  }, delayMs);
}

async function mirrorAppStateOnce() {
  const [{ supabase, isSupabaseConfigured }, { Store }] = await Promise.all([
    import('../lib/supabaseClient.js'),
    import('../store.js'),
  ]);

  const u = Store.get('user');
  if (!isSupabaseConfigured() || !supabase || !u?.id || u.source !== 'supabase') return;

  const snapshot = structuredClone({
    ...Store._state || {},
    user: undefined,
  });

  delete snapshot.user;

  const { error } = await supabase
    .from('gymbuddy_app_state')
    .upsert({
      user_id: u.id,
      state: snapshot,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) console.warn('[cloudMirror]', error.message);
}
