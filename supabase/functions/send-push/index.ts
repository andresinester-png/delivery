import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY       = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY      = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails(
  'mailto:admin@vicunaya.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const { order, owner_id } = await req.json();

    if (!owner_id) {
      return new Response(
        JSON.stringify({ error: 'owner_id required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', owner_id);

    if (error) throw error;

    if (!subs?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscriptions for this owner' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const itemCount = order.items?.length ?? 0;
    const total     = (order.total ?? 0).toLocaleString('es-AR');

    const payload = JSON.stringify({
      title: '🛵 Nuevo pedido — VicuñaYa',
      body:  `${order.customer_name} · ${itemCount} producto${itemCount !== 1 ? 's' : ''} · $${total}`,
      url:   '/restaurant/panel/pedidos',
    });

    const results = await Promise.allSettled(
      subs.map(({ subscription }) => webpush.sendNotification(subscription, payload)),
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Remove stale subscriptions (410 Gone / 404)
    const gone: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = (r.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          gone.push((subs[i].subscription as { endpoint: string }).endpoint);
        }
      }
    });
    if (gone.length) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('subscription->>endpoint', gone);
    }

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[send-push]', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
