#include <ADCTouch.h>

// Define the 6 analog pins on the Arduino Uno
const int touchPins[6] = {A0, A1, A2, A3, A4, A5};

// Calibration offsets for each pin
int refOffsets[6];

// Sensitivity threshold: readings exceeding (baseline + THRESHOLD) register as touched
// Adjust between 30 and 70 depending on touch surface and pad size
const int THRESHOLD = 40;

void setup() {
  Serial.begin(9600);
  while (!Serial); // Wait for Serial monitor to open

  // Read baseline reference values (takes 100 samples per pin for stability)
  for (int i = 0; i < 6; i++) {
    refOffsets[i] = ADCTouch.read(touchPins[i], 100);
  }

  pinMode(LED_BUILTIN, OUTPUT);

  // Print header
  Serial.println("a0\ta1\ta2\ta3\ta4\ta5");
}

void loop() {
  uint8_t touchStates[6];

  // Sample each pin and evaluate binary touch state
  for (int i = 0; i < 6; i++) {
    // Read raw relative capacitance change (current value minus reference)
    int value = ADCTouch.read(touchPins[i]) - refOffsets[i];
    // Evaluate binary state: 1 if touched, 0 if untouched
    touchStates[i] = (value > THRESHOLD) ? 1 : 0;
  }

  // Output formatted binary states tab-separated
  for (int i = 0; i < 6; i++) {
    Serial.print(touchStates[i]);
    if (touchStates[i] == 1){
      digitalWrite(LED_BUILTIN, HIGH);
    }
    if (i < 5) {
      Serial.print("\t");
    }
  }
  Serial.println();

  delay(50); // Loop pacing
  digitalWrite(LED_BUILTIN, LOW);
}