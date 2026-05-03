import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

void main() {
  runApp(const OrderflowApp());
}

class OrderflowApp extends StatelessWidget {
  const OrderflowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Orderflow',
      theme: ThemeData(
        scaffoldBackgroundColor: const Color(0xFFf8fafc),
        primaryColor: const Color(0xFFFF4B2B),
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFFF4B2B)),
        fontFamily: 'Inter',
        useMaterial3: true,
      ),
      home: const SplashOrHome(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class SplashOrHome extends StatefulWidget {
  const SplashOrHome({super.key});

  @override
  State<SplashOrHome> createState() => _SplashOrHomeState();
}

class _SplashOrHomeState extends State<SplashOrHome> {
  bool _isLoading = true;
  String? _savedUrl;

  @override
  void initState() {
    super.initState();
    _checkSavedUrl();
  }

  Future<void> _checkSavedUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString('server_url');
    setState(() {
      _savedUrl = url;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_savedUrl != null && _savedUrl!.isNotEmpty) {
      return WebViewScreen(url: _savedUrl!);
    }
    return const ConnectionScreen();
  }
}

class ConnectionScreen extends StatefulWidget {
  const ConnectionScreen({super.key});

  @override
  State<ConnectionScreen> createState() => _ConnectionScreenState();
}

class _ConnectionScreenState extends State<ConnectionScreen> {
  final TextEditingController _ipController = TextEditingController();
  final TextEditingController _portController = TextEditingController(text: '3000');
  final TextEditingController _codeController = TextEditingController();
  bool _isScanningNetwork = false;
  bool _hasUpdate = false;
  String _latestVersion = '';

  @override
  void initState() {
    super.initState();
    _checkForUpdates();
  }

  Future<void> _checkForUpdates() async {
    try {
      final response = await http.get(Uri.parse('https://api.github.com/repos/Ibotweat/Orderflow/releases/latest')).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        String latestVersion = data['tag_name'] as String;
        if (latestVersion.startsWith('v')) latestVersion = latestVersion.substring(1);
        
        const currentVersion = '1.0.11';
        
        if (latestVersion != currentVersion) {
          if (mounted) {
            setState(() {
              _hasUpdate = true;
              _latestVersion = latestVersion;
            });
          }
          
          final prefs = await SharedPreferences.getInstance();
          final ignoredVersion = prefs.getString('ignored_version');
          
          if (ignoredVersion != latestVersion && mounted) {
            _showUpdateDialog(latestVersion);
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  void _showUpdateDialog(String version) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mise à jour disponible'),
        content: Text('La version $version d\'Orderflow est disponible.\\nVoulez-vous la télécharger maintenant ?'),
        actions: [
          TextButton(
            onPressed: () async {
              final prefs = await SharedPreferences.getInstance();
              await prefs.setString('ignored_version', version);
              if (context.mounted) Navigator.of(context).pop();
            },
            child: const Text('Ignorer', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Plus tard', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              launchUrl(Uri.parse('https://github.com/Ibotweat/Orderflow/releases/latest/download/Orderflow_Mobile.apk'), mode: LaunchMode.externalApplication);
            },
            child: const Text('Mettre à jour', style: TextStyle(color: Color(0xFFFF4B2B), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _saveAndConnect(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', url);
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => WebViewScreen(url: url)),
      );
    }
  }

  void _connectManually() {
    if (_ipController.text.isNotEmpty && _codeController.text.isNotEmpty) {
      final url = 'http://${_ipController.text}:${_portController.text}/admin/login.html?code=${_codeController.text}';
      _saveAndConnect(url);
    }
  }

  Future<void> _autoDetectServer() async {
    setState(() => _isScanningNetwork = true);
    
    try {
      final info = NetworkInfo();
      final wifiIP = await info.getWifiIP();
      
      if (wifiIP != null && wifiIP.contains('.')) {
        final subnet = wifiIP.substring(0, wifiIP.lastIndexOf('.'));
        final port = _portController.text.isNotEmpty ? _portController.text : '3000';
        
        bool found = false;
        
        // Scan in parallel chunks to be fast but not exhaust sockets
        for (int i = 1; i < 255; i += 20) {
          if (found) break;
          
          List<Future<void>> checks = [];
          for (int j = 0; j < 20 && (i + j) < 255; j++) {
            final testIp = '$subnet.${i + j}';
            checks.add(() async {
              try {
                final response = await http.get(Uri.parse('http://$testIp:$port/api/menu')).timeout(const Duration(milliseconds: 1500));
                if (response.statusCode == 200 || response.statusCode == 401) {
                  if (!found) {
                    found = true;
                    if (mounted) {
                      setState(() {
                        _ipController.text = testIp;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Serveur trouvé ! Entrez votre code PIN.'), backgroundColor: Colors.green),
                      );
                    }
                  }
                }
              } catch (e) {
                // Ignore timeouts
              }
            }());
          }
          await Future.wait(checks);
        }
        
        if (!found && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Aucun serveur trouvé. Assurez-vous d\'être sur le même WiFi.'), backgroundColor: Colors.orange),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Veuillez vous connecter au WiFi d\'abord.'), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors de la recherche du réseau.'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isScanningNetwork = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(32.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 25, offset: const Offset(0, 10)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Orderflow', textAlign: TextAlign.center, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFFFF4B2B))),
                  const SizedBox(height: 8),
                  const Text('Accès Serveur', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 16)),
                  const SizedBox(height: 32),
                  
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (context) => const QRScannerScreen()),
                      ).then((scannedUrl) {
                        if (scannedUrl != null && scannedUrl is String) {
                          _saveAndConnect(scannedUrl);
                        }
                      });
                    },
                    icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
                    label: const Text('Scanner le QR Code', style: TextStyle(fontSize: 16, color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF4B2B),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                  ),
                  
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Row(
                      children: [
                        Expanded(child: Divider(color: Color(0xFFe2e8f0))),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Text('OU MANUEL', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                        Expanded(child: Divider(color: Color(0xFFe2e8f0))),
                      ],
                    ),
                  ),
                  
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextField(
                          controller: _ipController,
                          decoration: InputDecoration(
                            labelText: 'Adresse IP du PC',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 1,
                        child: TextField(
                          controller: _portController,
                          decoration: InputDecoration(
                            labelText: 'Port',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  OutlinedButton.icon(
                    onPressed: _isScanningNetwork ? null : _autoDetectServer,
                    icon: _isScanningNetwork 
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) 
                      : const Icon(Icons.wifi_find, size: 18),
                    label: Text(_isScanningNetwork ? 'Recherche en cours...' : 'Détecter automatiquement le PC'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF334155),
                      side: const BorderSide(color: Color(0xFFe2e8f0)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  TextField(
                    controller: _codeController,
                    decoration: InputDecoration(
                      labelText: 'Code PIN',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 24),
                  
                  ElevatedButton(
                    onPressed: _connectManually,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF4B2B), // accent color
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: const Text('Se Connecter', style: TextStyle(fontSize: 16, color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                  
                  if (_hasUpdate) ...[
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => launchUrl(Uri.parse('https://github.com/Ibotweat/Orderflow/releases/latest/download/Orderflow_Mobile.apk'), mode: LaunchMode.externalApplication),
                      icon: const Icon(Icons.system_update, color: Colors.white),
                      label: Text('Mettre à jour (v$_latestVersion)', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        elevation: 0,
                      ),
                    ),
                  ],
                  
                  const SizedBox(height: 24),
                  const Text('v1.0.11', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 12)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({super.key});

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  final MobileScannerController cameraController = MobileScannerController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner le QR Code', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFFFF4B2B),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: MobileScanner(
        controller: cameraController,
        onDetect: (capture) {
          final List<Barcode> barcodes = capture.barcodes;
          if (barcodes.isNotEmpty) {
            final String? rawValue = barcodes.first.rawValue;
            if (rawValue != null && rawValue.startsWith('http')) {
              cameraController.stop();
              Navigator.of(context).pop(rawValue);
            }
          }
        },
      ),
    );
  }
}

class WebViewScreen extends StatefulWidget {
  final String url;

  const WebViewScreen({super.key, required this.url});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFf8fafc))
      ..loadRequest(Uri.parse(widget.url));
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('server_url');
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const ConnectionScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: WebViewWidget(controller: _controller),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _logout,
        backgroundColor: Colors.redAccent,
        mini: true,
        child: const Icon(Icons.exit_to_app, color: Colors.white),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.startFloat,
    );
  }
}
