---
equipmentType: electric_motor
manualId: motor-m1
revision: 2.4
---

# Three-Phase AC Squirrel-Cage Induction Motor Technical Manual

## Equipment Overview and Normal Operating Ranges

Three-phase squirrel-cage induction motors are the primary electromechanical prime movers across industrial plants, driving pumps, fans, compressors, and conveyors. The motor consists of a cast-iron stator frame containing copper wire coils insulated to Class F specifications (155°C maximum rating), a laminated rotor core with aluminum/copper bars, precision drive-end (DE) and non-drive-end (NDE) deep-groove ball or cylindrical roller bearings, and an integrated external cooling fan.

During continuous steady-state operation under balanced sinusoidal utility voltage, the motor operates near synchronous slip speed with minimal electrical and thermal losses. Rated baseline parameters include:
- Stator Winding Temperature: Monitored via internal embedded RTD sensors, operating between 50°C and 95°C.
- Drive End Bearing Temperature: Front shaft bearing operates between 40°C and 75°C.
- Non-Drive End Bearing Temperature: Rear cooling fan bearing operates between 35°C and 70°C.
- Overall Vibration RMS: Radial casing vibration conforms to ISO 10816-3 between 0.4 and 2.5 mm/s.
- Phase Current Draw: Nominal full load running current spans 10 to 50 A.
- Current Phase Unbalance: Maximum current variance across L1, L2, and L3 remains within 0% to 3%.

## Fault Descriptions

### Stator Winding Overheating and Thermal Degradation
- Symptoms: Burned varnish odor emitted from air exhaust cowl; discolored casing paint; tripping of thermal overload relays or thermistor relays.
- Typical Causes: Sustained mechanical over-load, blocked ventilation shroud, high ambient temperature, low line voltage causing current escalation, or repeated rapid starts.
- Related Sensor Signatures: Winding temperature climbing past 110°C (critical emergency trip > 130°C), accompanied by continuous high current draw exceeding 55 A.

### Drive End Bearing Grease Desiccation and Raceway Flaking
- Symptoms: High-frequency metallic chirp progressing to rough rumbling growl; grease expulsion past V-ring seals; elevated DE bearing cap temperature.
- Typical Causes: Incompatible grease mixing, over-greasing hydraulic churning, excessive belt tension side-loading, or angular shaft misalignment.
- Related Sensor Signatures: Drive end bearing temperature exceeding 85°C (critical > 95°C), with casing vibration RMS escalating above 3.5 mm/s.

### Non-Drive End Bearing Breakdown and Fan Rubbing
- Symptoms: Rattling or scraping noise from the rear motor cowling; rear housing warm to touch; accumulation of plastic or aluminum shavings from the fan blade.
- Typical Causes: Axial spring preload washer collapse, axial shaft migration, or contaminated lubricant from airborne dust washdown.
- Related Sensor Signatures: Non-drive end bearing temperature exceeding 80°C (critical > 90°C), accompanied by localized vibration spikes.

### Phase Current Unbalance and Single-Phasing Condition
- Symptoms: Pronounced 100/120 Hz electromagnetic hum; rapid heating of stator iron; loss of output torque and speed droop under load.
- Typical Causes: Blown fuse on one phase, high-resistance oxidized terminal lug connection, loose MCC contactor tips, or incoming utility grid voltage imbalance.
- Related Sensor Signatures: Current phase unbalance exceeding 5% (critical shutdown > 10%), current draw on remaining phases surging past 55 A (critical > 65 A).

### Rotor Mechanical Unbalance and Eccentricity
- Symptoms: Strong 1X rotational frequency radial vibration that increases quadratically with speed; rhythmic shaking of motor baseplate and driven equipment.
- Typical Causes: Missing rotor balance weights, broken rotor bars, accumulated dirt buildup inside rotor cooling ducts, or bent motor output shaft.
- Related Sensor Signatures: Vibration RMS exceeding 3.5 mm/s (critical > 5.5 mm/s), while winding temperatures remain within acceptable limits.

### Structural Soft Foot and Baseplate Looseness
- Symptoms: High 2X electrical line frequency vibration; erratic vibration readings that change drastically when individual anchor bolts are loosened.
- Typical Causes: Non-planar baseplate foundation, inadequate shimming beneath motor mounting feet, or fractured foundation anchor grout.
- Related Sensor Signatures: Overall vibration RMS exceeding 3.5 mm/s (critical > 5.5 mm/s), which drops sharply when defective foot bolt is relaxed.

## Maintenance Instructions and Procedures

### Step-by-Step Motor Insulation Resistance (Megger) Testing
1. Lockout/Tagout motor electrical supply at the main circuit breaker; verify zero voltage on all incoming terminals with calibrated voltage tester.
2. Disconnect motor feeder cables at the motor terminal box to isolate windings from variable frequency drive (VFD) electronics.
3. Remove delta or star jumper links between motor terminals (U1, V1, W1, U2, V2, W2).
4. Set calibrated digital megohmmeter to 1000V DC test voltage.
5. Connect negative test lead to the motor ground stud (clean bare metal); connect positive lead to each winding terminal in sequence.
6. Apply test voltage for 60 seconds; record insulation resistance in Megohms (MΩ). Resistance must exceed 100 MΩ at 40°C. If resistance is below 5 MΩ, bake windings or rewinding is mandatory.
7. Discharge each tested winding to ground before touching terminals.

### Bearing Re-Lubrication Procedure
1. Clean grease zerk fittings on both DE and NDE bearing brackets using solvent wipe.
2. Remove bottom grease relief plug to prevent internal seal blowout from over-pressurization.
3. While motor is operating (or rotating shaft manually under LOTO), pump specified quantity (typically 15-20 grams) of synthetic polyurea grease slowly.
4. Allow motor to run for 20 minutes with relief plug open to permit grease expansion and excess purge.
5. Reinstall and torque grease relief plug.

## Safety Warnings and Hazard Protocols

### Lethal Electrical Shock and Stored Capacitor Energy Hazard
Induction motor terminal boxes carry dangerous 480V three-phase electrical potentials capable of causing instantaneous electrocution. Always execute MCC lockout/tagout. If the motor is driven by a VFD, wait at least 10 minutes after disconnecting power for DC bus capacitors to discharge to < 50V before opening junction box.

### Mechanical Entanglement and Rotating Shaft Hazard
Motor shafts and keyed couplings rotate at up to 3600 RPM. Loose clothing, jewelry, or hair can be pulled into machinery instantly resulting in traumatic injury. Never operate without OSHA-approved shaft guards securely bolted in place.

### Severe Thermal Surface Hazard
During sustained heavy-load operation, the motor frame and terminal box can exceed 90°C. Avoid bare skin contact. Always allow motor to cool for at least 30 minutes before conducting maintenance.

## Alarm Limits and Sensor Thresholds

| Sensor Metric | Key | Unit | Normal Range | Warning Limit | Critical Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Stator Winding Temperature | `winding_temp_c` | °C | 50 – 95 | > 110 | > 130 |
| Drive End (DE) Bearing Temp | `bearing_de_temp_c` | °C | 40 – 75 | > 85 | > 95 |
| Non-Drive End (NDE) Bearing Temp | `bearing_nde_temp_c` | °C | 35 – 70 | > 80 | > 90 |
| Overall Vibration RMS | `vibration_rms_mms` | mm/s | 0.4 – 2.5 | > 3.5 | > 5.5 |
| Phase Current (Average) | `current_draw_amps` | A | 10 – 50 | > 55 | > 65 |
| Current Phase Unbalance | `current_unbalance_pct` | % | 0 – 3 | > 5 | > 10 |
