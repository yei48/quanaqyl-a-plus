BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-photos', 'profile-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS quanaqyl_photo_read ON storage.objects;
DROP POLICY IF EXISTS quanaqyl_photo_insert ON storage.objects;
DROP POLICY IF EXISTS quanaqyl_photo_delete ON storage.objects;
CREATE POLICY quanaqyl_photo_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY quanaqyl_photo_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY quanaqyl_photo_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
COMMIT;
