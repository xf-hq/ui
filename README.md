# XF UI: Modular library for implementing user interfaces in the DOM

A library of modular, composable functionality designed for implementing user interfaces using modern web standards.

This is not a framework! Every effort is made here to keep each feature of the library as self-contained and independent as possible, making it easy to opt in to certain features without dragging in dependencies for things that aren't otherwise going to be relevant. Exports should therefore prioritise the use of interfaces over concrete classes, and should prefer interface designs that are based on general patterns of usage, rather than on specific implementation details. Compositions of interfaces should be used to create abstraction layers for bridging from general use case patterns to implementation-specific choices and solutions.
