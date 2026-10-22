// Admin-only module (architecture report-t53.md §4.5). This is the ONLY module
// in src/ that may read a service-role name — the privilege split is what makes
// the R4(d) source scan meaningful ("the service-role names appear only in
// admin modules and scripts/").
//
// C4: the names SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY are read here and
// nowhere else in src/. The alias is resolved by the caller, not here.

/** The service-role key, or null when neither alias is set. A blank value
 *  counts as unset. */
export function supabaseServiceRoleKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || null
  );
}
