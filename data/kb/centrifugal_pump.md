---
equipmentType: centrifugal_pump
manualId: pump-m1
revision: 2.1
---

# Centrifugal Pump Technical Operations & Maintenance Manual

## Equipment Overview and Normal Operating Ranges

Centrifugal pumps are dynamic machines utilized to transfer industrial process fluids and cooling liquids by converting mechanical rotational energy from an electric drive motor into kinetic hydrodynamic energy through an impeller. This series features a single-stage end-suction volute design with grease-lubricated heavy-duty ball and roller bearings and a cartridge-style mechanical face seal.

Under optimal operating conditions, fluid flow remains laminar through the suction eye and volute diffuser. Typical operational parameters for continuous duty include:
- Bearing Temperature: Normal operating envelope is between 35°C and 70°C.
- Overall Vibration RMS: Normal baseline vibration ranges from 0.5 to 3.0 mm/s.
- Discharge Pressure: Operating pressure spans 60 to 120 psi depending on process resistance.
- Suction Pressure: Net positive suction pressure must remain between 10 and 30 psi to maintain adequate Net Positive Suction Head available (NPSHa).
- Motor Current: Electrical power draw runs between 15 and 40 A under rated continuous flow.
- Mechanical Seal Leakage: Normal containment allows minimal vapor dispersion or 0 to 5 ml/min liquid collection.

## Fault Descriptions

### Cavitation and Vapor Bubble Implosion
- Symptoms: Characteristic cracking, popping, or gravel-like noise inside the volute housing accompanied by erratic discharge pressure swings and high-frequency casing vibration.
- Typical Causes: Inadequate Net Positive Suction Head available (NPSHa) below required levels (NPSHr), clogged suction strainers, partially closed inlet valves, or liquid temperature approaching vapor pressure.
- Related Sensor Signatures: Suction pressure falling below 5 psi (critical below 2 psi), discharge pressure fluctuating wildly between 40 and 90 psi, and vibration RMS surging past 4.5 mm/s.

### Mechanical Seal Face Degradation and Leakage
- Symptoms: Visual dripping or continuous stream from the gland drainage port, vapor cloud formation, localized chemical odor, and moisture accumulation on the pump baseplate.
- Typical Causes: Dry running during startup, thermal shock from rapid fluid temperature cycling, particulate scoring of silicon carbide seal faces, or excessive shaft runout.
- Related Sensor Signatures: Seal leakage flow rate exceeding 15 ml/min (critical > 50 ml/min), accompanied by localized bearing temperature increases above 75°C.

### Shaft Misalignment and Angular Deflection
- Symptoms: Elevated radial and axial vibration predominantly at 1X and 2X shaft rotational frequencies, premature elastomeric coupling spider wear, and rapid bearing temperature rise.
- Typical Causes: Thermal pipe strain on pump casing nozzles, improper shimming during initial laser alignment, loose foundation anchor bolts, or soft foot conditions.
- Related Sensor Signatures: Vibration RMS exceeding 4.5 mm/s (critical > 7.0 mm/s), and bearing temperature escalating past 75°C under normal load.

### Bearing Fatigue, Spalling, and Lubrication Breakdown
- Symptoms: Metallic grinding, persistent high-pitch squeal, localized discoloration of the bearing housing paint, and blackened or oxidized grease expulsion.
- Typical Causes: Contamination by moisture or process washdown, grease degradation from thermal over-stressing, over-greasing causing churning, or normal L10 bearing fatigue.
- Related Sensor Signatures: Bearing temperature exceeding 75°C (critical > 85°C), high-frequency vibration acceleration spikes, and overall vibration RMS exceeding 4.5 mm/s.

### Impeller Vane Erosion and Solid Debris Jam
- Symptoms: Progressive decline in pump discharge head, inability to satisfy process flow demands, increased electrical current draw, and rhythmic mechanical thumping.
- Typical Causes: Ingestion of foreign hard solids, long-term slurry erosion on vane leading edges, or chemical corrosion of 316 stainless steel impeller geometry.
- Related Sensor Signatures: Discharge pressure falling below 50 psi (critical < 35 psi), accompanied by motor current spiking above 45 A (critical > 52 A) when binding occurs.

### Internal Recirculation and Discharge Blockage
- Symptoms: Rapid thermal buildup in the pump liquid casing, boiling or flashing of trapped liquid, surging discharge pressure, and violent low-frequency vibration.
- Typical Causes: Operating against a closed or jammed discharge check valve, throttling flow below minimum continuous stable flow (MCSF), or blocked downstream filters.
- Related Sensor Signatures: Discharge pressure spiking above 135 psi (critical > 150 psi), casing and bearing temperatures climbing past 75°C, while suction pressure remains stable.

## Maintenance Instructions and Procedures

### Step-by-Step Bearing Inspection and Lubrication
1. Confirm pump lockout/tagout has been executed and zero hydraulic energy state is verified.
2. Clean the exterior of the bearing frame and grease relief ports thoroughly before introducing lubrication.
3. Remove grease drain plugs to allow purged grease to escape without pressurizing bearing seals.
4. Using a calibrated grease gun with specified Polyurea NLGI Grade 2 grease, slowly apply 8 to 12 strokes while rotating the pump shaft manually.
5. Inspect purged grease for discoloration, particulate grit, or brass/steel wear flakes. If metallic particles are detected, schedule bearing replacement.
6. Reinstall drain plug after allowing excess grease to vent during a 15-minute test run.

### Step-by-Step Mechanical Seal Replacement Procedure
1. Isolate suction and discharge valves, drain the casing fluid completely, and flush hazardous process fluids according to site protocols.
2. Unbolt the spacer coupling and remove the spacer element without disturbing the motor alignment.
3. Loosen gland nuts and carefully slide the cartridge mechanical seal assembly axially away from the seal chamber.
4. Clean and inspect the pump shaft sleeve for fretting, pitting, or burrs; polish with 400-grit crocus cloth if minor scoring is observed.
5. Install the new cartridge seal assembly, torque gland nuts in a star pattern to 25 Nm, and tighten collar set screws onto the shaft.
6. Verify setting clips are removed only after gland bolts and set screws are fully torqued.
7. Rotate the shaft by hand to verify smooth rotation with no binding before refilling the casing.

## Safety Warnings and Hazard Protocols

### Lockout/Tagout (LOTO) Requirement
Always isolate the electrical disconnect switch at the motor control center (MCC) with personal lockout padlock and tag. Discharge and test three-phase leads before physical access. Depress local start button to confirm absolute zero energy state. Never service a running or energized pump.

### Pressurised Fluid and Chemical Containment Hazard
Centrifugal pump casings can retain severe hydraulic pressure and hazardous, corrosive, or boiling chemicals even when stopped. Always verify suction and discharge isolation valves are locked shut. Slowly vent casing drain valves into an approved catchment container while monitoring pressure gauges to guarantee atmospheric pressure before loosening flange bolts.

### Hot Surfaces and Rotating Shaft Hazards
Bearing housings, pump volutes, and drive couplings can exceed 80°C during extended runs. Wear heat-resistant gloves during inspection. Ensure all coupling guards are securely installed and interlocked before returning equipment to operational status.

## Alarm Limits and Sensor Thresholds

| Sensor Metric | Key | Unit | Normal Range | Warning Limit | Critical Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Bearing Temperature | `bearing_temp_c` | °C | 35 – 70 | > 75 | > 85 |
| Vibration Overall RMS | `vibration_rms_mms` | mm/s | 0.5 – 3.0 | > 4.5 | > 7.0 |
| Discharge Pressure | `discharge_pressure_psi` | psi | 60 – 120 | < 50 or > 135 | < 35 or > 150 |
| Suction Pressure | `suction_pressure_psi` | psi | 10 – 30 | < 5 | < 2 |
| Motor Current | `motor_current_amps` | A | 15 – 40 | > 45 | > 52 |
| Mechanical Seal Leakage | `seal_leakage_flow_mlpm` | ml/min | 0 – 5 | > 15 | > 50 |
