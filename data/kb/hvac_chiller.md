---
equipmentType: hvac_chiller
manualId: chiller-m1
revision: 3.0
---

# Industrial HVAC Water-Cooled Chiller Operations & Service Manual

## Equipment Overview and Normal Operating Ranges

Water-cooled packaged chillers provide steady-state chilled water distribution to air handling units and industrial process cooling loops. The refrigeration system consists of a direct-drive semi-hermetic screw compressor, a shell-and-tube flooded evaporator, an electronic expansion valve (EEV), a water-cooled shell-and-tube condenser, and microprocessor safety controls.

Heat absorbed from the facility chilled water loop in the evaporator is rejected into the cooling tower water loop across the condenser tubes. Standard steady-state operational parameters for nominal cooling capacity are:
- Chilled Water Leaving Temperature: Evaporator chilled supply water maintains 4°C to 8°C.
- Condenser Water Leaving Temperature: Cooling tower water exiting the condenser shell resides within 28°C to 38°C.
- Evaporator Suction Pressure: Suction saturated refrigerant pressure operates between 35 and 50 psi.
- Condenser Head Pressure: High side discharge refrigerant pressure stays between 120 and 180 psi.
- Compressor Vibration RMS: Casing vibration velocity remains within 0.5 to 2.5 mm/s.
- Compressor Motor Current: Full-load current draw ranges between 40 and 90 A under normal refrigeration load.

## Fault Descriptions

### Condenser Tube Scale Fouling and Elevated Head Pressure
- Symptoms: Chiller control panel issues high-condenser-pressure alarm; cooling capacity diminishes; compressor motor runs with elevated thermal load; high approach temperature.
- Typical Causes: Mineral scale (calcium carbonate) deposits, biological slime from cooling tower water, or reduced cooling tower water circulation flow rate.
- Related Sensor Signatures: Condenser pressure exceeding 200 psi (critical trip > 230 psi), and condenser leaving water temperature rising past 43°C (critical > 48°C).

### Evaporator Low Temperature and Freeze Hazard
- Symptoms: Rapid drop in chilled water delivery temperature; low suction pressure alarms; icing or frost formation on suction pipe manifold and expansion valve body.
- Typical Causes: Low chilled water loop circulation flow, fouled evaporator strainer, malfunctioning water flow switch, or defective EEV controller.
- Related Sensor Signatures: Evaporator leaving water temperature dropping below 2°C (critical emergency shutdown < 0°C to prevent tube burst), with evaporator suction pressure falling below 30 psi (critical < 22 psi).

### Refrigerant Loss and Low Suction Pressure Starvation
- Symptoms: Subcooling and superheat measurements deviate drastically from nominal; compressor cycles on low-pressure cutoff; visible oily residue around flare joints.
- Typical Causes: Pinhole rupture on relief piping, mechanical joint fatigue from vibration, or leaking Schrader charging ports.
- Related Sensor Signatures: Evaporator suction pressure falling below 30 psi (critical < 22 psi) while motor current drops below 35 A due to vapor mass starvation.

### Compressor Screw Rotor Bearing Fatigue and Vibration Alarm
- Symptoms: Audible rumbling growl from compressor casing; high-frequency vibration alarms; elevated oil return line temperature.
- Typical Causes: Radial bearing clearance opening past allowable tolerances, shaft axial play, or liquid refrigerant floodback washing away lubricating oil film.
- Related Sensor Signatures: Compressor vibration RMS surging past 3.8 mm/s (critical trip > 5.5 mm/s), accompanied by motor current fluctuations above 105 A.

### Electronic Expansion Valve (EEV) Stepper Motor Jam
- Symptoms: Superheat swings erratically between 0K (floodback risk) and 25K (starvation); chilled water temperature fails to reach setpoint.
- Typical Causes: Foreign moisture freezing inside valve orifice, stepper motor stator coil burnout, or stripped valve needle gear train.
- Related Sensor Signatures: Evaporator suction pressure hunting erratically outside 35-50 psi envelope; compressor vibration increasing during liquid ingestion.

### High Compressor Motor Overload and Electrical Phase Stress
- Symptoms: Motor thermal overload protection trips; circuit breaker trip; electrical enclosure hot to touch; ozone odor near motor terminal box.
- Typical Causes: Low supply line voltage, unbalanced electrical grid phase, locked or binding compressor slide valve, or degraded motor stator insulation.
- Related Sensor Signatures: Compressor motor current exceeding 105 A (critical shutdown > 120 A), with rapid rise in compressor casing temperature.

## Maintenance Instructions and Procedures

### Step-by-Step Condenser Tube Mechanical Brushing
1. Perform Lockout/Tagout on chiller power supply and isolate condenser water supply and return isolation valves.
2. Remove condenser waterbox drain plugs and allow all cooling tower water to drain completely into trench.
3. Rig lifting hoist to the waterbox heads; unbolt flange bolts evenly and set heads aside on wooden cribbing.
4. Inspect internal copper tubes for pitting, scaling, and silt accumulation using a high-intensity inspection light.
5. Connect a rotary nylon tube-cleaning brush to a water-flushing shaft system; pass brush through each tube until clean copper metal is visible.
6. Flush tubes thoroughly with clean water, clean gasket sealing faces, install fresh neoprene gaskets, and torque waterbox bolts in sequence to 120 Nm.

### Refrigerant Leak Testing and Evacuation Protocol
1. Connect certified digital manifold gauge set to high- and low-side service Schrader valves.
2. Pressurize system with dry nitrogen and 5% trace helium up to 150 psi; use ultrasonic leak detector to trace all brazed and flanged joints.
3. Repair identified leaks using silver brazing alloy with continuous nitrogen purge to prevent internal soot oxidation.
4. Connect deep two-stage rotary vacuum pump and pull system vacuum down below 500 microns; perform 30-minute standing vacuum hold test.
5. Recharge system with virgin HFC/HFO refrigerant by weight according to OEM nameplate specification.

## Safety Warnings and Hazard Protocols

### High-Pressure Refrigerant Release and Asphyxiation Hazard
Refrigerant is stored under high pressure. Sudden rupture can displace oxygen in mechanical equipment rooms causing rapid asphyxiation and death. Ensure mechanical room ventilation fans and refrigerant gas leak sensors are operational before entering. Always wear cryogenic-rated safety gloves and splash-resistant eye protection.

### Tube Freezing and Rupture Catastrophe Warning
Allowing evaporator water temperature to drop to 0°C will result in water freezing inside thin-wall evaporator tubes. Expanding ice causes catastrophic tube rupture, introducing thousands of gallons of water into the refrigerant circuit. Never bypass or override the low-temperature freeze safety trip.

### High Electrical Voltage and Arc Flash Hazard
The chiller starter cabinet operates at 460V / 3-phase high power. De-energize feeder at the substation MCC, padlock disconnect in OFF position, apply personal tag, and verify zero voltage on all phases with an arc-flash rated multimeter before accessing starter contacts.

## Alarm Limits and Sensor Thresholds

| Sensor Metric | Key | Unit | Normal Range | Warning Limit | Critical Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Chilled Water Leaving Temp | `evaporator_temp_c` | °C | 4 – 8 | < 2 | < 0 |
| Condenser Leaving Water Temp | `condenser_temp_c` | °C | 28 – 38 | > 43 | > 48 |
| Evaporator Suction Pressure | `evaporator_pressure_psi` | psi | 35 – 50 | < 30 | < 22 |
| Condenser Head Pressure | `condenser_pressure_psi` | psi | 120 – 180 | > 200 | > 230 |
| Compressor Vibration | `compressor_vibration_rms_mms` | mm/s | 0.5 – 2.5 | > 3.8 | > 5.5 |
| Compressor Motor Current | `motor_current_amps` | A | 40 – 90 | > 105 | > 120 |
