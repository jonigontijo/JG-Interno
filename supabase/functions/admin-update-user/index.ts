import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // #region agent log
    console.log(JSON.stringify({
      sessionId: 'e62233',
      location: 'admin-update-user:env',
      data: {
        hasUrl: !!supabaseUrl,
        hasServiceRole: !!serviceRoleKey,
        serviceRoleLen: serviceRoleKey?.length || 0,
        hasAnon: !!anonKey,
      },
      timestamp: Date.now(),
    }));
    // #endregion

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let callerId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      callerId = payload.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try service-role first (bypasses RLS)
    let callerIsAdmin = false;
    let adminCheckSource = 'service_role';
    let serviceRoleProfile: any = null;
    let serviceRoleErr: any = null;
    {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, is_admin")
        .eq("id", callerId)
        .maybeSingle();
      serviceRoleProfile = data;
      serviceRoleErr = error;
      if (data?.is_admin) callerIsAdmin = true;
    }

    // Fallback: use the caller's JWT (RLS allows authenticated users to read their own profile)
    let callerJwtProfile: any = null;
    let callerJwtErr: any = null;
    if (!callerIsAdmin) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await callerClient
        .from("profiles")
        .select("id, is_admin")
        .eq("id", callerId)
        .maybeSingle();
      callerJwtProfile = data;
      callerJwtErr = error;
      if (data?.is_admin) {
        callerIsAdmin = true;
        adminCheckSource = 'caller_jwt';
      }
    }

    // #region agent log
    console.log(JSON.stringify({
      sessionId: 'e62233',
      location: 'admin-update-user:admin-check',
      data: {
        callerId,
        callerIsAdmin,
        adminCheckSource,
        serviceRoleProfile,
        serviceRoleErr: serviceRoleErr ? { message: serviceRoleErr.message, code: serviceRoleErr.code, details: serviceRoleErr.details } : null,
        callerJwtProfile,
        callerJwtErr: callerJwtErr ? { message: callerJwtErr.message, code: callerJwtErr.code } : null,
      },
      timestamp: Date.now(),
    }));
    // #endregion

    if (!callerIsAdmin) {
      return new Response(JSON.stringify({
        error: "Forbidden",
        debug: {
          callerId,
          serviceRoleProfile,
          serviceRoleErrMsg: serviceRoleErr?.message,
          callerJwtProfile,
          callerJwtErrMsg: callerJwtErr?.message,
          hasServiceRoleKey: !!serviceRoleKey,
        },
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userId, email, password, username, userData } = await req.json();

    if (action === "update") {
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password && password.length >= 6) updateData.password = password;
      if (userData) updateData.user_metadata = userData;

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, user: data.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const safePassword = (password && password.length >= 6) ? password : null;

      if (!safePassword) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find((u: any) => u.email === email);
        if (existing) {
          const updatePayload: any = { email_confirm: true };
          if (userData) updatePayload.user_metadata = { ...existing.user_metadata, ...userData };

          const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, updatePayload);
          if (updateErr) {
            return new Response(JSON.stringify({ error: updateErr.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await supabaseAdmin.from("profiles").update({ active: true }).eq("id", existing.id);
          return new Response(JSON.stringify({ success: true, user: updated.user, reactivated: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Senha inv\u00e1lida (m\u00ednimo 6 caracteres) e usu\u00e1rio n\u00e3o existe para reativar" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: safePassword,
        email_confirm: true,
        user_metadata: userData || {},
      });

      if (error) {
        if (error.message.includes("already been registered") || error.message.includes("already exists") || (error as any).status === 422) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existing = listData?.users?.find((u: any) => u.email === email);
          if (existing) {
            const updatePayload: any = { email_confirm: true, password: safePassword };
            if (userData) updatePayload.user_metadata = { ...existing.user_metadata, ...userData };

            const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, updatePayload);
            if (updateErr) {
              return new Response(JSON.stringify({ error: updateErr.message }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            await supabaseAdmin.from("profiles").update({ active: true }).eq("id", existing.id);
            return new Response(JSON.stringify({ success: true, user: updated.user, reactivated: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, user: data.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ users: data.users.map((u: any) => ({ id: u.id, email: u.email })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
