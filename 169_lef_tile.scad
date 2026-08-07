// ==========================================================================
// Fast-Rendering Uniform Wall HexLED Fixture - 169 LED Serpentine Grid
// Mathematical Half-Wall Offset -> Instant OpenSCAD CSG Rendering & Exact 1.2mm Walls!
// ==========================================================================

hex_radius = 9.624; // 16.67mm LED pitch
wall_thickness = 1.20; // Uniform wall thickness everywhere
fixture_height = 8.50;
base_floor = 0.40;
led_tray_height = 2.00;
strip_width = hex_radius - wall_thickness/2; // LED groove width matches inner hexagon face width (9.024mm)
strip_depth = 1.60;

module hex_cell(is_right_end, is_left_end, is_even_row) {
  r_outer = hex_radius + wall_thickness/2;
  r_inner = hex_radius - wall_thickness/2;

  // Apothem (exact flat face distance along X axis for 30-deg rotated hexagon)
  a_inner = r_inner * sqrt(3)/2;
  a_outer = r_outer * sqrt(3)/2;

  groove_width = r_inner; // LED groove width matches vertical face height exactly

  difference() {
    // 1. Outer Hexagon Body
    rotate([0, 0, 30]) cylinder(r = r_outer, h = fixture_height, $fn = 6);
    
    // 2. Main Light Cavity (Upper chamber above LED tray bed)
    translate([0, 0, led_tray_height]) rotate([0, 0, 30]) cylinder(r = r_inner, h = fixture_height + 1, $fn = 6);
    
    // 3. Recessed LED Strip Groove (Clipped strictly within inner hex cavity footprint)
    intersection() {
      translate([0, 0, base_floor - 0.1]) rotate([0, 0, 30]) cylinder(r = r_inner, h = led_tray_height - base_floor + 0.2, $fn = 6);
      translate([-a_inner - 0.1, -groove_width/2, base_floor - 0.1]) cube([2 * a_inner + 0.2, groove_width, led_tray_height - base_floor + 0.2]);
    }

    // 4. Right Wall Pass-Through Tunnel (Internal divider wall only)
    if (!is_right_end) {
      translate([a_inner - 0.1, -groove_width/2, base_floor])
        cube([a_outer - a_inner + 0.2, groove_width, strip_depth + 0.4]);
    }

    // 5. Left Wall Pass-Through Tunnel (Internal divider wall only)
    if (!is_left_end) {
      translate([-a_outer - 0.1, -groove_width/2, base_floor])
        cube([a_outer - a_inner + 0.2, groove_width, strip_depth + 0.4]);
    }

    // 6. Bottom Plate Wire Cutout Holes (Start and end of each row)
    if (is_left_end) {
      translate([-a_inner, -groove_width/2, -0.1])
        cube([groove_width, groove_width, base_floor + 0.2]);
    }
    if (is_right_end) {
      translate([a_inner - groove_width, -groove_width/2, -0.1])
        cube([groove_width, groove_width, base_floor + 0.2]);
    }
  }
}

module full_169_fixture() {
  union() {
    translate([-58.345, 101.057, 0]) hex_cell(false, true, true);
    translate([-41.675, 101.057, 0]) hex_cell(false, false, true);
    translate([-25.005, 101.057, 0]) hex_cell(false, false, true);
    translate([-8.335, 101.057, 0]) hex_cell(false, false, true);
    translate([8.335, 101.057, 0]) hex_cell(false, false, true);
    translate([25.005, 101.057, 0]) hex_cell(false, false, true);
    translate([41.675, 101.057, 0]) hex_cell(false, false, true);
    translate([58.345, 101.057, 0]) hex_cell(true, false, true);
    translate([-66.680, 86.620, 0]) hex_cell(false, true, false);
    translate([-50.010, 86.620, 0]) hex_cell(false, false, false);
    translate([-33.340, 86.620, 0]) hex_cell(false, false, false);
    translate([-16.670, 86.620, 0]) hex_cell(false, false, false);
    translate([0.000, 86.620, 0]) hex_cell(false, false, false);
    translate([16.670, 86.620, 0]) hex_cell(false, false, false);
    translate([33.340, 86.620, 0]) hex_cell(false, false, false);
    translate([50.010, 86.620, 0]) hex_cell(false, false, false);
    translate([66.680, 86.620, 0]) hex_cell(true, false, false);
    translate([-75.015, 72.183, 0]) hex_cell(false, true, true);
    translate([-58.345, 72.183, 0]) hex_cell(false, false, true);
    translate([-41.675, 72.183, 0]) hex_cell(false, false, true);
    translate([-25.005, 72.183, 0]) hex_cell(false, false, true);
    translate([-8.335, 72.183, 0]) hex_cell(false, false, true);
    translate([8.335, 72.183, 0]) hex_cell(false, false, true);
    translate([25.005, 72.183, 0]) hex_cell(false, false, true);
    translate([41.675, 72.183, 0]) hex_cell(false, false, true);
    translate([58.345, 72.183, 0]) hex_cell(false, false, true);
    translate([75.015, 72.183, 0]) hex_cell(true, false, true);
    translate([-83.350, 57.747, 0]) hex_cell(false, true, false);
    translate([-66.680, 57.747, 0]) hex_cell(false, false, false);
    translate([-50.010, 57.747, 0]) hex_cell(false, false, false);
    translate([-33.340, 57.747, 0]) hex_cell(false, false, false);
    translate([-16.670, 57.747, 0]) hex_cell(false, false, false);
    translate([0.000, 57.747, 0]) hex_cell(false, false, false);
    translate([16.670, 57.747, 0]) hex_cell(false, false, false);
    translate([33.340, 57.747, 0]) hex_cell(false, false, false);
    translate([50.010, 57.747, 0]) hex_cell(false, false, false);
    translate([66.680, 57.747, 0]) hex_cell(false, false, false);
    translate([83.350, 57.747, 0]) hex_cell(true, false, false);
    translate([-91.685, 43.310, 0]) hex_cell(false, true, true);
    translate([-75.015, 43.310, 0]) hex_cell(false, false, true);
    translate([-58.345, 43.310, 0]) hex_cell(false, false, true);
    translate([-41.675, 43.310, 0]) hex_cell(false, false, true);
    translate([-25.005, 43.310, 0]) hex_cell(false, false, true);
    translate([-8.335, 43.310, 0]) hex_cell(false, false, true);
    translate([8.335, 43.310, 0]) hex_cell(false, false, true);
    translate([25.005, 43.310, 0]) hex_cell(false, false, true);
    translate([41.675, 43.310, 0]) hex_cell(false, false, true);
    translate([58.345, 43.310, 0]) hex_cell(false, false, true);
    translate([75.015, 43.310, 0]) hex_cell(false, false, true);
    translate([91.685, 43.310, 0]) hex_cell(true, false, true);
    translate([-100.020, 28.873, 0]) hex_cell(false, true, false);
    translate([-83.350, 28.873, 0]) hex_cell(false, false, false);
    translate([-66.680, 28.873, 0]) hex_cell(false, false, false);
    translate([-50.010, 28.873, 0]) hex_cell(false, false, false);
    translate([-33.340, 28.873, 0]) hex_cell(false, false, false);
    translate([-16.670, 28.873, 0]) hex_cell(false, false, false);
    translate([0.000, 28.873, 0]) hex_cell(false, false, false);
    translate([16.670, 28.873, 0]) hex_cell(false, false, false);
    translate([33.340, 28.873, 0]) hex_cell(false, false, false);
    translate([50.010, 28.873, 0]) hex_cell(false, false, false);
    translate([66.680, 28.873, 0]) hex_cell(false, false, false);
    translate([83.350, 28.873, 0]) hex_cell(false, false, false);
    translate([100.020, 28.873, 0]) hex_cell(true, false, false);
    translate([-108.355, 14.437, 0]) hex_cell(false, true, true);
    translate([-91.685, 14.437, 0]) hex_cell(false, false, true);
    translate([-75.015, 14.437, 0]) hex_cell(false, false, true);
    translate([-58.345, 14.437, 0]) hex_cell(false, false, true);
    translate([-41.675, 14.437, 0]) hex_cell(false, false, true);
    translate([-25.005, 14.437, 0]) hex_cell(false, false, true);
    translate([-8.335, 14.437, 0]) hex_cell(false, false, true);
    translate([8.335, 14.437, 0]) hex_cell(false, false, true);
    translate([25.005, 14.437, 0]) hex_cell(false, false, true);
    translate([41.675, 14.437, 0]) hex_cell(false, false, true);
    translate([58.345, 14.437, 0]) hex_cell(false, false, true);
    translate([75.015, 14.437, 0]) hex_cell(false, false, true);
    translate([91.685, 14.437, 0]) hex_cell(false, false, true);
    translate([108.355, 14.437, 0]) hex_cell(true, false, true);
    translate([-116.690, 0.000, 0]) hex_cell(false, true, false);
    translate([-100.020, 0.000, 0]) hex_cell(false, false, false);
    translate([-83.350, 0.000, 0]) hex_cell(false, false, false);
    translate([-66.680, 0.000, 0]) hex_cell(false, false, false);
    translate([-50.010, 0.000, 0]) hex_cell(false, false, false);
    translate([-33.340, 0.000, 0]) hex_cell(false, false, false);
    translate([-16.670, 0.000, 0]) hex_cell(false, false, false);
    translate([0.000, 0.000, 0]) hex_cell(false, false, false);
    translate([16.670, 0.000, 0]) hex_cell(false, false, false);
    translate([33.340, 0.000, 0]) hex_cell(false, false, false);
    translate([50.010, 0.000, 0]) hex_cell(false, false, false);
    translate([66.680, 0.000, 0]) hex_cell(false, false, false);
    translate([83.350, 0.000, 0]) hex_cell(false, false, false);
    translate([100.020, 0.000, 0]) hex_cell(false, false, false);
    translate([116.690, 0.000, 0]) hex_cell(true, false, false);
    translate([-108.355, -14.437, 0]) hex_cell(false, true, true);
    translate([-91.685, -14.437, 0]) hex_cell(false, false, true);
    translate([-75.015, -14.437, 0]) hex_cell(false, false, true);
    translate([-58.345, -14.437, 0]) hex_cell(false, false, true);
    translate([-41.675, -14.437, 0]) hex_cell(false, false, true);
    translate([-25.005, -14.437, 0]) hex_cell(false, false, true);
    translate([-8.335, -14.437, 0]) hex_cell(false, false, true);
    translate([8.335, -14.437, 0]) hex_cell(false, false, true);
    translate([25.005, -14.437, 0]) hex_cell(false, false, true);
    translate([41.675, -14.437, 0]) hex_cell(false, false, true);
    translate([58.345, -14.437, 0]) hex_cell(false, false, true);
    translate([75.015, -14.437, 0]) hex_cell(false, false, true);
    translate([91.685, -14.437, 0]) hex_cell(false, false, true);
    translate([108.355, -14.437, 0]) hex_cell(true, false, true);
    translate([-100.020, -28.873, 0]) hex_cell(false, true, false);
    translate([-83.350, -28.873, 0]) hex_cell(false, false, false);
    translate([-66.680, -28.873, 0]) hex_cell(false, false, false);
    translate([-50.010, -28.873, 0]) hex_cell(false, false, false);
    translate([-33.340, -28.873, 0]) hex_cell(false, false, false);
    translate([-16.670, -28.873, 0]) hex_cell(false, false, false);
    translate([0.000, -28.873, 0]) hex_cell(false, false, false);
    translate([16.670, -28.873, 0]) hex_cell(false, false, false);
    translate([33.340, -28.873, 0]) hex_cell(false, false, false);
    translate([50.010, -28.873, 0]) hex_cell(false, false, false);
    translate([66.680, -28.873, 0]) hex_cell(false, false, false);
    translate([83.350, -28.873, 0]) hex_cell(false, false, false);
    translate([100.020, -28.873, 0]) hex_cell(true, false, false);
    translate([-91.685, -43.310, 0]) hex_cell(false, true, true);
    translate([-75.015, -43.310, 0]) hex_cell(false, false, true);
    translate([-58.345, -43.310, 0]) hex_cell(false, false, true);
    translate([-41.675, -43.310, 0]) hex_cell(false, false, true);
    translate([-25.005, -43.310, 0]) hex_cell(false, false, true);
    translate([-8.335, -43.310, 0]) hex_cell(false, false, true);
    translate([8.335, -43.310, 0]) hex_cell(false, false, true);
    translate([25.005, -43.310, 0]) hex_cell(false, false, true);
    translate([41.675, -43.310, 0]) hex_cell(false, false, true);
    translate([58.345, -43.310, 0]) hex_cell(false, false, true);
    translate([75.015, -43.310, 0]) hex_cell(false, false, true);
    translate([91.685, -43.310, 0]) hex_cell(true, false, true);
    translate([-83.350, -57.747, 0]) hex_cell(false, true, false);
    translate([-66.680, -57.747, 0]) hex_cell(false, false, false);
    translate([-50.010, -57.747, 0]) hex_cell(false, false, false);
    translate([-33.340, -57.747, 0]) hex_cell(false, false, false);
    translate([-16.670, -57.747, 0]) hex_cell(false, false, false);
    translate([0.000, -57.747, 0]) hex_cell(false, false, false);
    translate([16.670, -57.747, 0]) hex_cell(false, false, false);
    translate([33.340, -57.747, 0]) hex_cell(false, false, false);
    translate([50.010, -57.747, 0]) hex_cell(false, false, false);
    translate([66.680, -57.747, 0]) hex_cell(false, false, false);
    translate([83.350, -57.747, 0]) hex_cell(true, false, false);
    translate([-75.015, -72.183, 0]) hex_cell(false, true, true);
    translate([-58.345, -72.183, 0]) hex_cell(false, false, true);
    translate([-41.675, -72.183, 0]) hex_cell(false, false, true);
    translate([-25.005, -72.183, 0]) hex_cell(false, false, true);
    translate([-8.335, -72.183, 0]) hex_cell(false, false, true);
    translate([8.335, -72.183, 0]) hex_cell(false, false, true);
    translate([25.005, -72.183, 0]) hex_cell(false, false, true);
    translate([41.675, -72.183, 0]) hex_cell(false, false, true);
    translate([58.345, -72.183, 0]) hex_cell(false, false, true);
    translate([75.015, -72.183, 0]) hex_cell(true, false, true);
    translate([-66.680, -86.620, 0]) hex_cell(false, true, false);
    translate([-50.010, -86.620, 0]) hex_cell(false, false, false);
    translate([-33.340, -86.620, 0]) hex_cell(false, false, false);
    translate([-16.670, -86.620, 0]) hex_cell(false, false, false);
    translate([0.000, -86.620, 0]) hex_cell(false, false, false);
    translate([16.670, -86.620, 0]) hex_cell(false, false, false);
    translate([33.340, -86.620, 0]) hex_cell(false, false, false);
    translate([50.010, -86.620, 0]) hex_cell(false, false, false);
    translate([66.680, -86.620, 0]) hex_cell(true, false, false);
    translate([-58.345, -101.057, 0]) hex_cell(false, true, true);
    translate([-41.675, -101.057, 0]) hex_cell(false, false, true);
    translate([-25.005, -101.057, 0]) hex_cell(false, false, true);
    translate([-8.335, -101.057, 0]) hex_cell(false, false, true);
    translate([8.335, -101.057, 0]) hex_cell(false, false, true);
    translate([25.005, -101.057, 0]) hex_cell(false, false, true);
    translate([41.675, -101.057, 0]) hex_cell(false, false, true);
    translate([58.345, -101.057, 0]) hex_cell(true, false, true);
  }
}

full_169_fixture();
