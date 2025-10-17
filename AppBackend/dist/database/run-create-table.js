"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAlbumPhotosTable = createAlbumPhotosTable;
const database_1 = require("../config/database");
async function createAlbumPhotosTable() {
    try {
        console.log('🔧 Creating albumphotos table...');
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS albumphotos (
          id SERIAL PRIMARY KEY,
          album_id INTEGER NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          photo_name VARCHAR(500) NOT NULL,
          photo_url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- Foreign keys
          FOREIGN KEY (album_id) REFERENCES Albums(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `;
        const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_albumphotos_album_id ON albumphotos(album_id);
      CREATE INDEX IF NOT EXISTS idx_albumphotos_user_id ON albumphotos(user_id);
      CREATE INDEX IF NOT EXISTS idx_albumphotos_photo_name ON albumphotos(photo_name);
    `;
        await database_1.pool.query(createTableSQL);
        console.log('✅ albumphotos table created!');
        await database_1.pool.query(createIndexesSQL);
        console.log('✅ albumphotos indexes created!');
        console.log('✅ albumphotos table setup completed successfully!');
    }
    catch (error) {
        console.error('❌ Error creating albumphotos table:', error.message);
        throw error;
    }
}
if (require.main === module) {
    createAlbumPhotosTable()
        .then(() => {
        console.log('🎉 Table creation completed!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 Table creation failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=run-create-table.js.map