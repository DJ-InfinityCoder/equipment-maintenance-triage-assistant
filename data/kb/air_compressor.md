---
equipmentType: air_compressor
manualId: compressor-m1
revision: 1.8
---

# Rotary Screw Industrial Air Compressor Technical Operations Manual

## Equipment Overview and Normal Operating Ranges

Rotary screw air compressors utilize twin intermeshing helical rotors (male and female) inside a precision-machined stator housing to continuously compress ambient atmospheric air for plant pneumatic instrumentation and mechanical tools. Synthetic coolant fluid is injected into the compression chamber to seal internal clearances, absorb heat of compression, and lubricate the rotor thrust bearings.

Under steady-state rated operation, the unit cycles between loaded compression and unloaded idle states governed by an electro-pneumatic inlet valve. Standard operating baselines for continuous industrial delivery are:
- Air Discharge Temperature: Normal airend outlet temperature is between 70°C and 95°C.
- Receiver Discharge Pressure: System distribution pressure operates steadily between 90 and 125 psi.
- Lube Oil Pressure: Lubricant circulation pressure across the oil circuit maintains 25 to 50 psi.
- Lube Oil Temperature: Oil sump and injection temperature resides within 50°C to 75°C.
- Airend Vibration RMS: Radial casing vibration remains within 0.5 to 2.8 mm/s.
- Drive Motor Current: Electrical motor draw fluctuates between 25 and 60 A depending on load state.

## Fault Descriptions

### High Airend Discharge Temperature and Thermal Trip
- Symptoms: Unit generates pre-alarm warning or emergency high-temperature trip; cooling fan running continuously; elevated thermal radiant heat from airend manifold.
- Typical Causes: Fouled oil cooler radiator fins, degraded or oxidized synthetic lubricant, low oil level in reservoir separator tank, or stuck thermostatic mixing valve.
- Related Sensor Signatures: Discharge temperature exceeding 100°C (critical emergency trip > 110°C), accompanied by oil temperature climbing past 80°C (critical > 90°C).

### Air-Oil Separator Media Fouling and Oil Carryover
- Symptoms: Excessive oil aerosol in downstream compressed air lines, rapid oil sump level depletion, milky condensate traps, and increased pneumatic drop across separator.
- Typical Causes: Contaminated oil aerosol separator element, clogged scavenger return line orifice, or wrong viscosity lubricant causing foaming.
- Related Sensor Signatures: Differential pressure across separator exceeding 12 psi, discharge pressure dropping while motor current increases above 68 A due to flow restriction.

### Airend Rotor Contact, Bearing Degradation, and Vibration Surge
- Symptoms: High-pitched grinding whine from compression module, metallic clicks during loaded cycle, elevated casing temperatures, and visible iron particles in oil filter.
- Typical Causes: Loss of axial rotor positioning clearance, thrust bearing race spalling, or extended operation past rated 40,000-hour airend overhaul life.
- Related Sensor Signatures: Airend vibration RMS rising above 4.0 mm/s (critical > 6.5 mm/s), and localized bearing housing temperature surging past 85°C.

### Lube Oil Pressure Starvation
- Symptoms: Oil pressure alert on control panel, loud chatter from internal gearset, rapid rise in compression temperature within seconds of loading.
- Typical Causes: Ruptured oil pump drive gear, clogged full-flow oil filter cartridge, oil foaming, or severe internal leakage across shaft seal seals.
- Related Sensor Signatures: Oil pressure plummeting below 20 psi (critical trip < 15 psi), accompanied by rapid upward thermal gradient on discharge air temperature.

### Inlet Unloader Valve Sticking and System Hunting
- Symptoms: Compressor cycles rapidly between loaded and unloaded states every few seconds; pressure fluctuates wildly in plant header; loud blowdown venting.
- Typical Causes: Moisture corrosion inside unloader piston cylinder, worn Viton seal rings, defective solenoid actuation valve, or fouled pilot air filter.
- Related Sensor Signatures: Motor current swinging erratically between 25 A and 68 A, discharge pressure swinging outside normal 90-125 psi band.

### Minimum Pressure Valve (MPV) Seizure
- Symptoms: Unit fails to build internal reservoir pressure upon start; backflow of air from plant header during shutdown; air starvation at receiver.
- Typical Causes: Broken internal MPV spring, carbon deposit buildup on valve seat, or deteriorated check valve disk seal.
- Related Sensor Signatures: Discharge pressure failing to rise above 60 psi despite motor current indicating full 60 A load, while airend discharge temp remains elevated.

## Maintenance Instructions and Procedures

### Step-by-Step Oil and Filter Replacement Procedure
1. Execute full Lockout/Tagout on primary electrical feeder and vent receiver air pressure down to 0 psi.
2. Allow lubricant to settle for 10 minutes while verifying sump pressure gauge reads exactly zero.
3. Open oil drain valve at base of separator vessel into dedicated containment pan; drain warm lubricant completely.
4. Using an oil filter strap wrench, remove and dispose of the spin-on oil filter element.
5. Coat the rubber gasket of the new high-efficiency filter with clean synthetic compressor oil, thread hand-tight, then tighten an additional 3/4 turn.
6. Refill reservoir vessel with OEM-specified polyolester synthetic lubricant until the sight glass indicates 3/4 level.
7. Close drain valve, power on machine, run unloaded for 5 minutes, then inspect for leaks and verify oil pressure exceeds 25 psi.

### Air-Oil Separator Element Inspection and Replacement
1. Disconnect and tag all pilot air tubing and the oil scavenger return line from the separator tank lid.
2. Remove the scavenger tube from the center bushing and clean the internal 0.8 mm restrictor orifice using solvent and low-pressure air.
3. Loosen tank lid perimeter bolts diagonally in two stages to relieve any remaining gasket tension.
4. Carefully lift separator cover using lifting hoist; inspect interior tank walls for varnish or sludge accumulation.
5. Lift out old separator cartridge and inspect grounding staples on flange gaskets for electrical continuity.
6. Install new separator cartridge ensuring grounding staples are intact to eliminate electrostatic discharge fire risk.
7. Reassemble lid, torque bolts to 85 Nm, and reconnect scavenger line with visual sight glass verification.

## Safety Warnings and Hazard Protocols

### Severe Pressurised Vessel Explosion Hazard
The air-oil separator tank and receiver vessels store compressed air up to 150 psi. Never attempt to loosen fittings, remove filler caps, or disconnect pipes while vessel is pressurized. Always open manual blowdown drain valve and verify vessel pressure gauge indicates zero psi before servicing.

### Thermal Scalding and Hot Oil Flash Point
Discharge pipes and lubricant temperatures regularly exceed 100°C. Contact with escaping oil or air will cause severe second- and third-degree thermal burns. Wear full face shield, thermal gauntlets, and long-sleeve protective apparel during oil servicing.

### Compressed Air Injection and Lockout/Tagout Warning
High-velocity compressed air can penetrate human skin causing air embolism and fatal tissue trauma. Never direct compressed air at personnel. Lockout main electrical circuit breaker and padlock the main pneumatic isolation valve in the closed position before commencing mechanical or electrical work.

## Alarm Limits and Sensor Thresholds

| Sensor Metric | Key | Unit | Normal Range | Warning Limit | Critical Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Air Discharge Temperature | `discharge_temp_c` | °C | 70 – 95 | > 100 | > 110 |
| Discharge Pressure | `discharge_pressure_psi` | psi | 90 – 125 | > 135 | > 150 |
| Lube Oil Pressure | `oil_pressure_psi` | psi | 25 – 50 | < 20 | < 15 |
| Lube Oil Temperature | `oil_temp_c` | °C | 50 – 75 | > 80 | > 90 |
| Airend Vibration RMS | `vibration_rms_mms` | mm/s | 0.5 – 2.8 | > 4.0 | > 6.5 |
| Drive Motor Current | `motor_current_amps` | A | 25 – 60 | > 68 | > 78 |
