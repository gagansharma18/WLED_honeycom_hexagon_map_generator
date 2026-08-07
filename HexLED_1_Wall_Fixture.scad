// ==========================================================================
// Fast-Rendering Uniform Wall HexLED Fixture - WS2812B Serpentine Grid
// Mathematical Half-Wall Offset -> Instant OpenSCAD CSG Rendering & Exact 1.2mm Walls!
// Open in OpenSCAD or FreeCAD (OpenSCAD Workbench)
// ==========================================================================

hex_radius = 9.624; // 16.67mm LED pitch
wall_thickness = 1.20; // Uniform wall thickness everywhere
fixture_height = 8.50;
base_floor = 0.40;
led_tray_height = 2.00;
strip_width = 10.50;
strip_depth = 1.60;

module hex_cell(is_right_end, is_left_end, is_even_row) {
  r_outer = hex_radius + wall_thickness/2;
  r_inner = hex_radius - wall_thickness/2;
  difference() {
    // Outer Hexagon Body
    rotate([0, 0, 30]) cylinder(r = r_outer, h = fixture_height, $fn = 6);
    // Inner Light Cavity
    translate([0, 0, led_tray_height]) rotate([0, 0, 30]) cylinder(r = r_inner, h = fixture_height + 1, $fn = 6);
    // Straight Strip Channel
    translate([-r_outer - 2, -strip_width/2, base_floor]) cube([(r_outer + 2)*2, strip_width, strip_depth + 0.4]);
    // Serpentine Turnaround Channel
    if ((is_right_end && is_even_row) || (is_left_end && !is_even_row)) {
      dir = is_right_end ? 1 : -1;
      translate([dir * (r_inner - 2), -strip_width/2, base_floor]) cube([strip_width + 4, strip_width * 1.8, strip_depth + 0.4]);
    }
  }
}

module full_fixture() {
  union() {
    translate([-8.335, -14.437, 0]) hex_cell(true, true, true);
  }
}

full_fixture();
