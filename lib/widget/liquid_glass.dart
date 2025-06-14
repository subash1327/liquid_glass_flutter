import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

class LiquidGlass extends StatefulWidget {
  final Widget child;
  final double borderRadius;
  final double blur;

  const LiquidGlass({
    super.key,
    required this.child,
    this.borderRadius = 16,
    this.blur = 0.0,
  });

  @override
  State<LiquidGlass> createState() => _LiquidGlassState();
}

class _LiquidGlassState extends State<LiquidGlass>
    with SingleTickerProviderStateMixin {
  ui.Image? maskImage;
  ui.FragmentShader? shader;
  final GlobalKey _key = GlobalKey();
  Offset? _offset;
  Size? _size;

  double time = 0;
  late final Ticker _ticker;
  @override
  void initState() {
    super.initState();
    loadShader();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final renderBox = _key.currentContext?.findRenderObject() as RenderBox?;
      if (renderBox != null) {
        _offset = renderBox.localToGlobal(Offset.zero);
        _size = renderBox.size;
        if (mounted) {
          setState(() {}); // Trigger a rebuild to apply the offset
        }
      }
    });

    _ticker = Ticker((elapsed) {
      if (!mounted) return;
      if (elapsed.inMicroseconds % 1000 != 0) {
        setState(() {
          time = elapsed.inMicroseconds.toDouble(); // seconds
        });
      }
    });

    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  static const String _packageName = 'liquid_glass_flutter';
  Future<void> loadShader() async {
    final program = await ui.FragmentProgram.fromAsset(
      'packages/$_packageName/assets/shaders/liquid_glass.frag',
    );
    setState(() {
      shader = program.fragmentShader();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (shader == null) {
      return widget.child;
    }

    final resolution = MediaQuery.of(context).size;

    final RenderBox? renderBox =
        _key.currentContext?.findRenderObject() as RenderBox?;
    _offset = renderBox?.localToGlobal(Offset.zero);
    _size = renderBox?.size;
    final offset = (_offset ?? Offset.zero) * 2;
    final size = _size ?? Size.zero;

    shader?.setFloat(0, resolution.width); // uResolution.x
    shader?.setFloat(1, resolution.height); // uResolution.y
    shader?.setFloat(2, offset.dx); // uCenter.x
    shader?.setFloat(3, offset.dy); // uCenter.y
    shader?.setFloat(4, time); // uTime
    shader?.setFloat(5, size.width);
    shader?.setFloat(6, size.height); // HEIGHT (half size)
    shader?.setFloat(7, widget.borderRadius); // uBorderRadius
    shader?.setFloat(8, 1); // uBlur
    final filter = ui.ImageFilter.shader(shader!);

    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: BackdropFilter(
        key: UniqueKey(),
        filter: filter,
        child: SizedBox(key: _key, child: widget.child),
      ),
    );
  }
}
