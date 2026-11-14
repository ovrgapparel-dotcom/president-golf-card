-- 003_verified_scorecard_and_3d_tour.sql
-- Resolves provisional flags using official club scorecard validation:
-- 1. Hole 7 White confirmed at 389 m (exact Aller total 3 103 m)
-- 2. Blue Retour verified at 2 454 m (exact total 5 221 m)
-- 3. Red Retour verified at 2 417 m (exact total 5 107 m)
-- 4. Hole status and distances upgraded from 'PROVISIONAL' to 'VERIFIED'
-- 5. 3D Model configured (Sketchfab President Golf Club Yamoussoukro)

-- Update Hole 7 White distance
update public.hole_tee_distances d
set distance_m = 389, data_status = 'VERIFIED'
from public.tee_sets t
where d.hole_number = 7 and d.tee_set_id = t.id and t.code = 'WHITE';

-- Update all other hole tee distances to VERIFIED
update public.hole_tee_distances
set data_status = 'VERIFIED'
where data_status = 'PROVISIONAL';

-- Update Red tee set total to 5107 m
update public.tee_sets
set total_distance_m = 5107
where code = 'RED';

-- Update holes to VERIFIED status
update public.holes
set data_status = 'VERIFIED'
where data_status = 'PROVISIONAL';

-- Update Hole 12 local rule
update public.holes
set notes = 'Trou n°12 (Green en île) : si la balle va directement dans l''eau (R. 26.1) ou après avoir touché l''île, jouer depuis la plus proche dropping zone (en arrière du green, à droite et à gauche).'
where hole_number = 12;

-- Resolve course data flags
update public.course_data_flags
set resolved = true,
    resolved_at = now(),
    resolution_notes = 'Confirmé et recoupé avec la carte de score officielle : Trou 7 Blanc = 389m (Total Aller 3103m), Retour Bleu = 2454m (Total 5221m), Retour Rouge = 2417m (Total 5107m).'
where scope in ('BLUE / Retour', 'WHITE / Aller', 'RED / Retour');

-- Attach Sketchfab 3D model
insert into public.virtual_views (hole_number, provider, scene_url, scene_id, label, is_active)
values (null, 'SKETCHFAB', 'https://sketchfab.com/3d-models/president-golf-club-yamoussoukro-619e57981a444a7e975290f6c292dd39', '619e57981a444a7e975290f6c292dd39', 'Modèle 3D President Golf Club Yamoussoukro', true)
on conflict do nothing;
