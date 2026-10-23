-- is_admin() is only needed by signed-in users (the admin panel's login check
-- and the write policies); signed-out visitors don't need to call it.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
