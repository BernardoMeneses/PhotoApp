// 📱 Métodos Flutter para Tamanho de Categorias e Álbuns

// ============================================
// 1️⃣ ADICIONAR NO api_service.dart
// ============================================

/// Obter tamanho total de uma categoria (soma de todos os álbuns)
static Future<Map<String, dynamic>> getCategorySize(int categoryId) async {
  final url = Uri.parse('$baseUrl/categories/$categoryId/size');
  final headers = await _authHeaders();

  final response = await http.get(url, headers: headers);

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['data'];
  } else {
    throw Exception('Erro ao obter tamanho da categoria: ${response.body}');
  }
}

/// Obter tamanho total de um álbum
static Future<Map<String, dynamic>> getAlbumSize(int albumId) async {
  final url = Uri.parse('$baseUrl/albums/$albumId/size');
  final headers = await _authHeaders();

  final response = await http.get(url, headers: headers);

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['data'];
  } else {
    throw Exception('Erro ao obter tamanho do álbum: ${response.body}');
  }
}

// ============================================
// 2️⃣ MODELO DE DADOS (category_size_model.dart)
// ============================================

class CategorySizeInfo {
  final int totalSize;
  final int albumCount;
  final int photoCount;
  final String formattedSize;
  final List<AlbumSizeDetail> albums;

  CategorySizeInfo({
    required this.totalSize,
    required this.albumCount,
    required this.photoCount,
    required this.formattedSize,
    required this.albums,
  });

  factory CategorySizeInfo.fromJson(Map<String, dynamic> json) {
    return CategorySizeInfo(
      totalSize: json['totalSize'],
      albumCount: json['albumCount'],
      photoCount: json['photoCount'],
      formattedSize: json['formattedSize'],
      albums: (json['albums'] as List)
          .map((album) => AlbumSizeDetail.fromJson(album))
          .toList(),
    );
  }
}

class AlbumSizeDetail {
  final int id;
  final String title;
  final int size;
  final int photoCount;
  final String formattedSize;

  AlbumSizeDetail({
    required this.id,
    required this.title,
    required this.size,
    required this.photoCount,
    required this.formattedSize,
  });

  factory AlbumSizeDetail.fromJson(Map<String, dynamic> json) {
    return AlbumSizeDetail(
      id: json['id'],
      title: json['title'],
      size: json['size'],
      photoCount: json['photoCount'],
      formattedSize: json['formattedSize'],
    );
  }
}

class AlbumSizeInfo {
  final int totalSize;
  final int photoCount;
  final String formattedSize;

  AlbumSizeInfo({
    required this.totalSize,
    required this.photoCount,
    required this.formattedSize,
  });

  factory AlbumSizeInfo.fromJson(Map<String, dynamic> json) {
    return AlbumSizeInfo(
      totalSize: json['totalSize'],
      photoCount: json['photoCount'],
      formattedSize: json['formattedSize'],
    );
  }
}

// ============================================
// 3️⃣ EXEMPLO DE USO - Widget de Categoria
// ============================================

class CategoryDetailPage extends StatefulWidget {
  final int categoryId;
  final String categoryName;

  const CategoryDetailPage({
    Key? key,
    required this.categoryId,
    required this.categoryName,
  }) : super(key: key);

  @override
  State<CategoryDetailPage> createState() => _CategoryDetailPageState();
}

class _CategoryDetailPageState extends State<CategoryDetailPage> {
  bool _isLoadingSize = false;
  CategorySizeInfo? _sizeInfo;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCategorySize();
  }

  Future<void> _loadCategorySize() async {
    setState(() {
      _isLoadingSize = true;
      _error = null;
    });

    try {
      final data = await ApiService.getCategorySize(widget.categoryId);
      setState(() {
        _sizeInfo = CategorySizeInfo.fromJson(data);
        _isLoadingSize = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoadingSize = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.categoryName),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card de resumo do tamanho
            _buildSizeCard(),
            const SizedBox(height: 20),

            // Lista de álbuns com tamanhos
            if (_sizeInfo != null) ...[
              Text(
                'Álbuns nesta categoria',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              ..._sizeInfo!.albums.map((album) => _buildAlbumTile(album)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSizeCard() {
    if (_isLoadingSize) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: Column(
              children: const [
                CircularProgressIndicator(),
                SizedBox(height: 12),
                Text('Calculando tamanho...'),
              ],
            ),
          ),
        ),
      );
    }

    if (_error != null) {
      return Card(
        color: Colors.red[50],
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              const Icon(Icons.error, color: Colors.red),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Erro: $_error',
                  style: const TextStyle(color: Colors.red),
                ),
              ),
              TextButton(
                onPressed: _loadCategorySize,
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
      );
    }

    if (_sizeInfo == null) {
      return const SizedBox();
    }

    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.storage, color: Colors.deepPurple, size: 32),
                const SizedBox(width: 12),
                Text(
                  'Espaço Utilizado',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              _sizeInfo!.formattedSize,
              style: TextStyle(
                fontSize: 36,
                fontWeight: FontWeight.bold,
                color: Colors.deepPurple,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${_sizeInfo!.albumCount} álbuns • ${_sizeInfo!.photoCount} fotos',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlbumTile(AlbumSizeDetail album) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.deepPurple[100],
          child: Icon(Icons.photo_album, color: Colors.deepPurple),
        ),
        title: Text(album.title),
        subtitle: Text('${album.photoCount} fotos'),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              album.formattedSize,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.deepPurple,
              ),
            ),
          ],
        ),
        onTap: () {
          // Navegar para detalhes do álbum
        },
      ),
    );
  }
}

// ============================================
// 4️⃣ EXEMPLO DE USO - Widget Simples (Card)
// ============================================

class CategorySizeCard extends StatelessWidget {
  final int categoryId;

  const CategorySizeCard({Key? key, required this.categoryId}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: ApiService.getCategorySize(categoryId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: const [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 12),
                  Text('Calculando...'),
                ],
              ),
            ),
          );
        }

        if (snapshot.hasError) {
          return Card(
            color: Colors.red[50],
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Erro: ${snapshot.error}'),
            ),
          );
        }

        if (!snapshot.hasData) {
          return const SizedBox();
        }

        final data = snapshot.data!;
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.storage, color: Colors.deepPurple),
                    const SizedBox(width: 8),
                    Text(
                      data['formattedSize'],
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.deepPurple,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${data['albumCount']} álbuns • ${data['photoCount']} fotos',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ============================================
// 5️⃣ EXEMPLO DE USO - Widget de Álbum
// ============================================

class AlbumSizeWidget extends StatelessWidget {
  final int albumId;

  const AlbumSizeWidget({Key? key, required this.albumId}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: ApiService.getAlbumSize(albumId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const CircularProgressIndicator();
        }

        if (snapshot.hasError) {
          return Text('Erro: ${snapshot.error}');
        }

        if (!snapshot.hasData) {
          return const SizedBox();
        }

        final data = snapshot.data!;
        return Row(
          children: [
            Icon(Icons.storage, size: 16, color: Colors.grey[600]),
            const SizedBox(width: 4),
            Text(
              data['formattedSize'],
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(width: 8),
            Icon(Icons.photo, size: 16, color: Colors.grey[600]),
            const SizedBox(width: 4),
            Text(
              '${data['photoCount']} fotos',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        );
      },
    );
  }
}

// ============================================
// 6️⃣ EXEMPLO COM GESTÃO DE ESTADO (Provider/Riverpod)
// ============================================

// Se estiveres a usar Provider ou Riverpod:

// Provider
class CategorySizeProvider extends ChangeNotifier {
  bool isLoading = false;
  CategorySizeInfo? sizeInfo;
  String? error;

  Future<void> loadCategorySize(int categoryId) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final data = await ApiService.getCategorySize(categoryId);
      sizeInfo = CategorySizeInfo.fromJson(data);
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }
}

// Uso com Provider:
// Consumer<CategorySizeProvider>(
//   builder: (context, provider, child) {
//     if (provider.isLoading) return CircularProgressIndicator();
//     if (provider.error != null) return Text('Erro: ${provider.error}');
//     if (provider.sizeInfo == null) return SizedBox();
//     
//     return Text('Tamanho: ${provider.sizeInfo!.formattedSize}');
//   },
// )
