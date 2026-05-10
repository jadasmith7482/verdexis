import 'package:flutter/material.dart';
import '../services/wallet_service.dart';

class CreateWalletPage extends StatefulWidget {
  const CreateWalletPage({super.key});

  @override
  State<CreateWalletPage> createState() => _CreateWalletPageState();
}

class _CreateWalletPageState extends State<CreateWalletPage> {
  final _walletService = WalletService();

  String? _mnemonic;
  String? _privateKey;
  String? _address;
  String? _error;
  bool _busy = false;

  Future<void> _createWallet() async {
    setState(() {
      _busy = true;
      _error = null;
      _mnemonic = null;
      _privateKey = null;
      _address = null;
    });

    try {
      final mnemonic = _walletService.generateMnemonic();
      final privateKey = await _walletService.privateKeyFromMnemonic(mnemonic);
      final address = await _walletService.addressFromPrivateKey(privateKey);

      setState(() {
        _mnemonic = mnemonic;
        _privateKey = privateKey;
        _address = address;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _loadExisting() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final key = await _walletService.getSavedPrivateKey();
      if (key == null) {
        setState(() => _error = 'No saved wallet key found.');
      } else {
        final address = await _walletService.addressFromPrivateKey(key);
        setState(() {
          _privateKey = key;
          _address = address;
        });
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _clearWallet() async {
    await _walletService.clearWallet();
    setState(() {
      _mnemonic = null;
      _privateKey = null;
      _address = null;
      _error = null;
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Wallet cleared from secure storage')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hiddenKey = _privateKey == null
        ? null
        : '${_privateKey!.substring(0, 8)}...${_privateKey!.substring(_privateKey!.length - 8)}';

    return Scaffold(
      appBar: AppBar(title: const Text('Safe Wallet Demo')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: [
            ElevatedButton(
              onPressed: _busy ? null : _createWallet,
              child: Text(_busy ? 'Creating...' : 'Generate New Wallet'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _busy ? null : _loadExisting,
              child: const Text('Load Saved Wallet'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _busy ? null : _clearWallet,
              child: const Text('Clear Saved Wallet'),
            ),
            const SizedBox(height: 20),

            if (_mnemonic != null) ...[
              const Text(
                'Recovery Phrase (save offline):',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              SelectableText(_mnemonic!),
              const SizedBox(height: 16),
            ],

            if (_address != null) ...[
              const Text(
                'Address:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              SelectableText(_address!),
              const SizedBox(height: 16),
            ],

            if (hiddenKey != null) ...[
              const Text(
                'Private Key (masked):',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              SelectableText(hiddenKey),
              const SizedBox(height: 16),
            ],

            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent),
              ),

            const SizedBox(height: 20),
            const Text(
              'Security note: This is a local wallet demo. It does NOT read seed phrases from MetaMask or any external wallet.',
              style: TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }
}
