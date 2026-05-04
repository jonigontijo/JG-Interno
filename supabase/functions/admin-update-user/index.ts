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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin (use caller's own JWT so RLS lets them read their own profile;
    // do NOT rely on service role here because if the env var is missing this whole branch breaks)
    const authHeader = req.headers.get("Authorization")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin status using the caller's own auth context (RLS allows users to read their own row).
    // Fallback to service role if RLS blocks the read for any reason.
    let callerIsAdmin = false;
    let adminCheckSource = 'caller';
    let profileErrorMsg: string | null = null;
    {
      const { data, error } = await callerClient
        .from("profiles")
        .select("is_admin")
        .eq("id", caller.id)
        .maybeSingle();
      if (error) profileErrorMsg = error.message;
      if (data?.is_admin) {
        callerIsAdmin = true;
      } else {
        const { data: adminData, error: adminErr } = await supabaseAdmin
          .from("profiles")
          .select("is_admin")
          .eq("id", caller.id)
          .maybeSingle();
        if (adminErr && !profileErrorMsg) profileErrorMsg = adminErr.message;
        if (adminData?.is_admin) {
          callerIsAdmin = true;
          adminCheckSource = 'service_role';
        }
      }
    }

    // #region agent log
    console.log(JSON.stringify({
      sessionId: 'e62233',
      location: 'admin-update-user:admin-check',
      data: {
        callerId: caller.id,
        callerEmail: caller.email,
        callerIsAdmin,
        adminCheckSource,
        profileErrorMsg,
        hasServiceRoleKey: !!serviceRoleKey,
        serviceRoleKeyLen: serviceRoleKey?.length || 0,
      },
      timestamp: Date.now(),
    }));
    // #endregion

    if (!callerIsAdmin) {
      return new Response(JSON.stringify({
        error: "Forbidden",
        debug: { callerId: caller.id, profileErrorMsg, hasServiceRoleKey: !!serviceRoleKey },
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userId, email, password, username, userData } = await req.json();

    if (action === "update") {
      // Update user auth credentials
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
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

    if (action === "list") {
      // List all auth users to find user by email
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ users: data.users.map(u => ({ id: u.id, email: u.email })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      // Try to create user with admin API (auto-confirms)
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: userData || {},
      });

      if (error) {
        // If user already exists in auth, reactivate them
        if (error.message.includes("already been registered")) {
          // Find existing user by email
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = listData?.users?.find((u: any) => u.email === email);

          if (existingUser) {
            // Update the existing auth user with new data
            const { data: updatedData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password: password,
              email_confirm: true,
              user_metadata: userData || {},
              ban_duration: "none",
            });

            if (updateError) {
              return new Response(JSON.stringify({ error: updateError.message }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            // Reactivate profile
            await supabaseAdmin.from("profiles").update({
              active: true,
              name: userData?.name || "",
              role: userData?.role || "",
              roles: userData?.roles || [],
              is_admin: userData?.is_admin || false,
              module_access: userData?.module_access || [],
            }).eq("id", existingUser.id);

            return new Response(JSON.stringify({ success: true, user: updatedData.user, reactivated: true }), {
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
      // Delete user from auth completely
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

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
