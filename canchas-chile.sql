-- =====================================================
-- CANCHAS DE GOLF EN CHILE - DATOS OFICIALES
-- =====================================================

-- 1. PRINCE OF WALES COUNTRY CLUB
-- --------------------------------
INSERT OR REPLACE INTO campos (slug, nombre, ciudad, pais, hoyos, par_total, slope_rating, course_rating, activo)
VALUES ('prince-of-wales', 'Prince of Wales Country Club', 'La Reina, Santiago', 'Chile', 18, 72, 132, 76.4, 1);

-- Hoyos Prince of Wales (desde tees azules)
INSERT OR REPLACE INTO hoyos (campo_slug, hoyo, par, handicap_index, yardas_blancas, yardas_amarillas, yardas_rojas) VALUES
('prince-of-wales', 1, 4, 11, 361, 340, 310),
('prince-of-wales', 2, 4, 9, 376, 355, 320),
('prince-of-wales', 3, 5, 3, 551, 520, 480),
('prince-of-wales', 4, 3, 17, 173, 155, 140),
('prince-of-wales', 5, 4, 7, 420, 395, 360),
('prince-of-wales', 6, 4, 5, 444, 420, 385),
('prince-of-wales', 7, 3, 15, 189, 170, 150),
('prince-of-wales', 8, 4, 13, 375, 355, 320),
('prince-of-wales', 9, 5, 1, 561, 530, 490),
('prince-of-wales', 10, 4, 16, 380, 360, 330),
('prince-of-wales', 11, 3, 18, 149, 135, 120),
('prince-of-wales', 12, 4, 4, 439, 415, 380),
('prince-of-wales', 13, 4, 12, 410, 390, 355),
('prince-of-wales', 14, 5, 14, 522, 495, 460),
('prince-of-wales', 15, 3, 6, 221, 200, 175),
('prince-of-wales', 16, 4, 2, 398, 375, 345),
('prince-of-wales', 17, 4, 8, 398, 375, 345),
('prince-of-wales', 18, 5, 10, 537, 510, 475);

-- 2. CLUB DE GOLF LA DEHESA
-- -------------------------
INSERT OR REPLACE INTO campos (slug, nombre, ciudad, pais, hoyos, par_total, slope_rating, course_rating, activo)
VALUES ('la-dehesa', 'Club de Golf La Dehesa', 'Lo Barnechea, Santiago', 'Chile', 18, 72, 131, 74.9, 1);

-- Hoyos La Dehesa (desde tees negros)
INSERT OR REPLACE INTO hoyos (campo_slug, hoyo, par, handicap_index, yardas_blancas, yardas_amarillas, yardas_rojas) VALUES
('la-dehesa', 1, 5, 15, 556, 520, 480),
('la-dehesa', 2, 4, 7, 434, 410, 375),
('la-dehesa', 3, 3, 17, 204, 185, 165),
('la-dehesa', 4, 4, 1, 434, 410, 375),
('la-dehesa', 5, 4, 11, 412, 390, 355),
('la-dehesa', 6, 4, 9, 426, 400, 365),
('la-dehesa', 7, 4, 3, 410, 385, 350),
('la-dehesa', 8, 3, 13, 202, 185, 165),
('la-dehesa', 9, 5, 5, 594, 560, 520),
('la-dehesa', 10, 4, 10, 438, 415, 380),
('la-dehesa', 11, 4, 18, 426, 400, 370),
('la-dehesa', 12, 4, 4, 415, 390, 355),
('la-dehesa', 13, 3, 14, 181, 165, 145),
('la-dehesa', 14, 5, 2, 594, 560, 520),
('la-dehesa', 15, 4, 16, 407, 385, 350),
('la-dehesa', 16, 4, 12, 407, 385, 350),
('la-dehesa', 17, 3, 8, 216, 195, 175),
('la-dehesa', 18, 5, 6, 671, 630, 590);

-- 3. CLUB DE GOLF SPORT FRANCÉS
-- -----------------------------
INSERT OR REPLACE INTO campos (slug, nombre, ciudad, pais, hoyos, par_total, slope_rating, course_rating, activo)
VALUES ('sport-frances', 'Club de Golf Sport Francés', 'Vitacura, Santiago', 'Chile', 18, 72, 133, 72.5, 1);

-- Hoyos Sport Francés (desde tees azules)
INSERT OR REPLACE INTO hoyos (campo_slug, hoyo, par, handicap_index, yardas_blancas, yardas_amarillas, yardas_rojas) VALUES
('sport-frances', 1, 4, 13, 392, 365, 351),
('sport-frances', 2, 4, 3, 371, 350, 330),
('sport-frances', 3, 4, 7, 410, 377, 364),
('sport-frances', 4, 3, 15, 187, 163, 153),
('sport-frances', 5, 4, 11, 387, 356, 332),
('sport-frances', 6, 4, 1, 419, 401, 355),
('sport-frances', 7, 3, 17, 164, 151, 146),
('sport-frances', 8, 5, 9, 550, 505, 440),
('sport-frances', 9, 5, 5, 524, 501, 439),
('sport-frances', 10, 4, 12, 391, 367, 334),
('sport-frances', 11, 3, 18, 177, 164, 154),
('sport-frances', 12, 4, 4, 369, 344, 276),
('sport-frances', 13, 5, 8, 602, 570, 482),
('sport-frances', 14, 4, 14, 344, 314, 291),
('sport-frances', 15, 4, 2, 425, 382, 352),
('sport-frances', 16, 3, 16, 196, 173, 161),
('sport-frances', 17, 4, 10, 420, 381, 338),
('sport-frances', 18, 5, 6, 572, 531, 507);

-- 4. CLUB DE GOLF LOS LEONES
-- --------------------------
-- Nota: Los pares son estimados basados en canchas similares en Santiago
INSERT OR REPLACE INTO campos (slug, nombre, ciudad, pais, hoyos, par_total, slope_rating, course_rating, activo)
VALUES ('los-leones', 'Club de Golf Los Leones', 'Las Condes, Santiago', 'Chile', 18, 72, 128, 71.5, 1);

-- Hoyos Los Leones (estimados - actualizar con datos oficiales)
INSERT OR REPLACE INTO hoyos (campo_slug, hoyo, par, handicap_index, yardas_blancas, yardas_amarillas, yardas_rojas) VALUES
('los-leones', 1, 4, 7, 385, 360, 330),
('los-leones', 2, 4, 11, 370, 350, 320),
('los-leones', 3, 5, 3, 520, 490, 455),
('los-leones', 4, 3, 15, 165, 150, 135),
('los-leones', 5, 4, 1, 430, 405, 375),
('los-leones', 6, 4, 9, 395, 375, 345),
('los-leones', 7, 3, 17, 175, 160, 145),
('los-leones', 8, 5, 5, 535, 505, 470),
('los-leones', 9, 4, 13, 380, 360, 330),
('los-leones', 10, 4, 8, 400, 380, 350),
('los-leones', 11, 3, 16, 155, 140, 125),
('los-leones', 12, 4, 4, 420, 395, 365),
('los-leones', 13, 5, 2, 545, 515, 480),
('los-leones', 14, 4, 12, 385, 365, 335),
('los-leones', 15, 4, 6, 410, 385, 355),
('los-leones', 16, 3, 18, 180, 165, 150),
('los-leones', 17, 4, 10, 390, 370, 340),
('los-leones', 18, 5, 14, 510, 480, 450);

-- 5. HACIENDA DE CHICUREO
-- -----------------------
INSERT OR REPLACE INTO campos (slug, nombre, ciudad, pais, hoyos, par_total, slope_rating, course_rating, activo)
VALUES ('hacienda-chicureo', 'Hacienda de Chicureo', 'Chicureo, Santiago', 'Chile', 18, 72, 130, 72.0, 1);

-- Hoyos Hacienda Chicureo (estimados)
INSERT OR REPLACE INTO hoyos (campo_slug, hoyo, par, handicap_index, yardas_blancas, yardas_amarillas, yardas_rojas) VALUES
('hacienda-chicureo', 1, 4, 9, 395, 370, 340),
('hacienda-chicureo', 2, 5, 5, 540, 510, 475),
('hacienda-chicureo', 3, 3, 17, 170, 155, 140),
('hacienda-chicureo', 4, 4, 3, 435, 410, 380),
('hacienda-chicureo', 5, 4, 11, 380, 360, 330),
('hacienda-chicureo', 6, 4, 7, 405, 385, 355),
('hacienda-chicureo', 7, 3, 15, 185, 170, 155),
('hacienda-chicureo', 8, 5, 1, 565, 535, 500),
('hacienda-chicureo', 9, 4, 13, 375, 355, 325),
('hacienda-chicureo', 10, 4, 10, 390, 370, 340),
('hacienda-chicureo', 11, 4, 4, 425, 400, 370),
('hacienda-chicureo', 12, 3, 18, 160, 145, 130),
('hacienda-chicureo', 13, 5, 2, 555, 525, 490),
('hacienda-chicureo', 14, 4, 8, 400, 380, 350),
('hacienda-chicureo', 15, 4, 12, 385, 365, 335),
('hacienda-chicureo', 16, 3, 16, 175, 160, 145),
('hacienda-chicureo', 17, 5, 6, 530, 500, 465),
('hacienda-chicureo', 18, 4, 14, 370, 350, 320);

-- 6. LAS BRISAS DE CHICUREO (actualizar datos existentes)
-- -------------------------------------------------------
UPDATE campos SET slope_rating = 130, course_rating = 72.0 WHERE slug = 'las-brisas';
