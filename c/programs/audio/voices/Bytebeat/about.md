# Bytebeat

Pioneered by Viznut in 2011, Bytebeat is a minimalist form of electronic music created entirely from short C-like expressions that generate 8-bit audio waveforms in real-time.

Compositions consist of mathematical expressions and bitwise operators that define waveforms purely as functions of time.

The `t` variable is a counter that increments every sample (typically at 8,000 times per second).
All sound derives from manipulating `t` with math/bitwise operations.
Since `t` constantly grows, expressions like `t * (t >> 10)` create evolving patterns as the bits shift and overflow.

Modes:

- **Bytebeat**: Unsigned 8-bit integer output (0–255). Values wrap on overflow/underflow; decimals are truncated.
- **Signed Bytebeat**: Signed 8-bit integer output (−127 to 128). Values wrap; decimals are truncated.
- **Floatbeat**: Floating-point output (−1.0 to 1.0). Offers superior audio fidelity by avoiding the 8-bit value limitation.
- **Funcbeat**: Code executes once to return a function, which then receives time (seconds) as input and produces output in the −1.0 to 1.0 range.

Made by [Zombectro](https://zombect.ro)  
Library from [dollchan.net/bytebeat](https://dollchan.net/bytebeat)  
[History of Bytebeat](http://canonical.org/~kragen/bytebeat/)
