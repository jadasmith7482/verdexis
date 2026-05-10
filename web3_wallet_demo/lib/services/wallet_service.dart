import 'package:bip39/bip39.dart' as bip39;
import 'package:ed25519_hd_key/ed25519_hd_key.dart';
import 'package:convert/convert.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:web3dart/web3dart.dart';

class WalletService {
  static const _storage = FlutterSecureStorage();
  static const _privateKeyKey = 'wallet_private_key';

  String generateMnemonic() {
    return bip39.generateMnemonic();
  }

  Future<String> privateKeyFromMnemonic(String mnemonic) async {
    final clean = mnemonic.trim();
    if (!bip39.validateMnemonic(clean)) {
      throw Exception('Invalid mnemonic phrase');
    }

    final seed = bip39.mnemonicToSeed(clean);
    final master = await ED25519_HD_KEY.getMasterKeyFromSeed(seed);
    final privateKeyHex = hex.encode(master.key);

    await _storage.write(key: _privateKeyKey, value: privateKeyHex);
    return privateKeyHex;
  }

  Future<String?> getSavedPrivateKey() async {
    return _storage.read(key: _privateKeyKey);
  }

  Future<String> addressFromPrivateKey(String privateKeyHex) async {
    final key = EthPrivateKey.fromHex(privateKeyHex);
    return key.address.hexEip55;
  }

  Future<void> clearWallet() async {
    await _storage.delete(key: _privateKeyKey);
  }
}
