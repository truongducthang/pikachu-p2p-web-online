import React, { useState, useEffect } from 'react';
import { Gamepad2, Users, Trophy, Timer, Zap, RefreshCw } from 'lucide-react';

// ===== FIREBASE CONFIG =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDHI5fP-gtB0T21gWTep-8Yrh5aBhrWmr0",
  authDomain: "pikachu-p2p.firebaseapp.com",
  databaseURL: "https://pikachu-p2p-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pikachu-p2p",
  storageBucket: "pikachu-p2p.firebasestorage.app",
  messagingSenderId: "398675376396",
  appId: "1:398675376396:web:7220de5240179aead3f129"
};

// Firebase simple client (không cần npm install)
class FirebaseDB {
  constructor(config) {
    this.baseUrl = config.databaseURL;
    this.listeners = new Map();
  }

  async set(path, data) {
    try {
      const response = await fetch(`${this.baseUrl}/${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Firebase set error:', error);
      return null;
    }
  }

  async update(path, data) {
    try {
      const response = await fetch(`${this.baseUrl}/${path}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Firebase update error:', error);
      return null;
    }
  }

  async get(path) {
    try {
      const response = await fetch(`${this.baseUrl}/${path}.json`);
      return await response.json();
    } catch (error) {
      console.error('Firebase get error:', error);
      return null;
    }
  }

  listen(path, callback) {
    const eventSource = new EventSource(`${this.baseUrl}/${path}.json`);
    
    eventSource.addEventListener('put', (e) => {
      const data = JSON.parse(e.data);
      if (data.data) {
        callback(data.data, 'put');
      }
    });

    eventSource.addEventListener('patch', (e) => {
      const data = JSON.parse(e.data);
      if (data.data) {
        callback(data.data, 'patch');
      }
    });

    this.listeners.set(path, eventSource);
    return () => eventSource.close();
  }

  stopListening(path) {
    const listener = this.listeners.get(path);
    if (listener) {
      listener.close();
      this.listeners.delete(path);
    }
  }
}

const db = new FirebaseDB(FIREBASE_CONFIG);

const PikachuGame = () => {
  const [screen, setScreen] = useState('menu');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(180);
  const [connectionPath, setConnectionPath] = useState(null);
  const [hintCells, setHintCells] = useState([]);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);
  const [roomList, setRoomList] = useState([]);

  useEffect(() => {
    // Kiểm tra Firebase config
    if (FIREBASE_CONFIG.databaseURL.includes('your-project')) {
      setIsFirebaseConfigured(false);
    } else {
      setIsFirebaseConfigured(true);
      // Lắng nghe danh sách phòng
      loadRoomList();
    }
  }, []);

  // Load danh sách phòng
  const loadRoomList = async () => {
    try {
      const rooms = await db.get('rooms');
      if (rooms) {
        const roomArray = Object.entries(rooms)
          .map(([code, data]) => ({
            code,
            ...data,
            playerCount: data.players ? Object.keys(data.players).length : 0
          }))
          .filter(room => room.status !== 'finished') // Chỉ hiện phòng chưa kết thúc
          .sort((a, b) => b.createdAt - a.createdAt) // Mới nhất trước
          .slice(0, 10); // Chỉ hiện 10 phòng gần nhất
        setRoomList(roomArray);
      }
    } catch (error) {
      console.error('Load room list error:', error);
    }
  };

  const icons = ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐙', '🦀', '🐠', '🐟', '🦈', '🐡', '🦐', '🦑', '🐢', '🦎', '🐊', '🦖', '🦕', '🐉', '🦅', '🦉'];
  
  const generateBoard = () => {
    const pairs = [];
    for (let i = 0; i < 32; i++) {
      const icon = icons[i];
      pairs.push({ id: i * 2, icon, matched: false });
      pairs.push({ id: i * 2 + 1, icon, matched: false });
    }
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    return pairs;
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const canGoStraightHorizontal = (board, row, col1, col2) => {
    const start = Math.min(col1, col2);
    const end = Math.max(col1, col2);
    for (let c = start + 1; c < end; c++) {
      if (!board[row * 8 + c].matched) return false;
    }
    return true;
  };

  const canGoStraightVertical = (board, col, row1, row2) => {
    const start = Math.min(row1, row2);
    const end = Math.max(row1, row2);
    for (let r = start + 1; r < end; r++) {
      if (!board[r * 8 + col].matched) return false;
    }
    return true;
  };

  const canConnect = (board, pos1, pos2, returnPath = false) => {
    if (pos1 === pos2) return false;
    const cell1 = board[pos1];
    const cell2 = board[pos2];
    if (cell1.icon !== cell2.icon) return false;
    if (cell1.matched || cell2.matched) return false;
    
    const row1 = Math.floor(pos1 / 8);
    const col1 = pos1 % 8;
    const row2 = Math.floor(pos2 / 8);
    const col2 = pos2 % 8;
    
    if (row1 === row2) {
      if (canGoStraightHorizontal(board, row1, col1, col2)) {
        if (returnPath) {
          const path = [];
          const start = Math.min(col1, col2);
          const end = Math.max(col1, col2);
          for (let c = start; c <= end; c++) {
            path.push([row1, c]);
          }
          return path;
        }
        return true;
      }
    }
    
    if (col1 === col2) {
      if (canGoStraightVertical(board, col1, row1, row2)) {
        if (returnPath) {
          const path = [];
          const start = Math.min(row1, row2);
          const end = Math.max(row1, row2);
          for (let r = start; r <= end; r++) {
            path.push([r, col1]);
          }
          return path;
        }
        return true;
      }
    }
    
    const cornerPos1 = row1 * 8 + col2;
    if (board[cornerPos1].matched || cornerPos1 === pos1 || cornerPos1 === pos2) {
      if (canGoStraightHorizontal(board, row1, col1, col2) && 
          canGoStraightVertical(board, col2, row1, row2)) {
        if (returnPath) {
          const path = [];
          const start = Math.min(col1, col2);
          const end = Math.max(col1, col2);
          for (let c = start; c <= end; c++) {
            path.push([row1, c]);
          }
          const startR = Math.min(row1, row2);
          const endR = Math.max(row1, row2);
          for (let r = startR; r <= endR; r++) {
            if (r !== row1) path.push([r, col2]);
          }
          return path;
        }
        return true;
      }
    }
    
    const cornerPos2 = row2 * 8 + col1;
    if (board[cornerPos2].matched || cornerPos2 === pos1 || cornerPos2 === pos2) {
      if (canGoStraightVertical(board, col1, row1, row2) && 
          canGoStraightHorizontal(board, row2, col1, col2)) {
        if (returnPath) {
          const path = [];
          const start = Math.min(row1, row2);
          const end = Math.max(row1, row2);
          for (let r = start; r <= end; r++) {
            path.push([r, col1]);
          }
          const startC = Math.min(col1, col2);
          const endC = Math.max(col1, col2);
          for (let c = startC; c <= endC; c++) {
            if (c !== col1) path.push([row2, c]);
          }
          return path;
        }
        return true;
      }
    }
    
    for (let r = 0; r < 8; r++) {
      const mid1 = r * 8 + col1;
      const mid2 = r * 8 + col2;
      
      if ((board[mid1].matched || mid1 === pos1) && 
          (board[mid2].matched || mid2 === pos2)) {
        if (canGoStraightVertical(board, col1, row1, r) &&
            canGoStraightHorizontal(board, r, col1, col2) &&
            canGoStraightVertical(board, col2, r, row2)) {
          if (returnPath) {
            const path = [];
            const start1 = Math.min(row1, r);
            const end1 = Math.max(row1, r);
            for (let row = start1; row <= end1; row++) {
              path.push([row, col1]);
            }
            const start2 = Math.min(col1, col2);
            const end2 = Math.max(col1, col2);
            for (let col = start2; col <= end2; col++) {
              if (col !== col1) path.push([r, col]);
            }
            const start3 = Math.min(r, row2);
            const end3 = Math.max(r, row2);
            for (let row = start3; row <= end3; row++) {
              if (row !== r) path.push([row, col2]);
            }
            return path;
          }
          return true;
        }
      }
    }
    
    for (let c = 0; c < 8; c++) {
      const mid1 = row1 * 8 + c;
      const mid2 = row2 * 8 + c;
      
      if ((board[mid1].matched || mid1 === pos1) && 
          (board[mid2].matched || mid2 === pos2)) {
        if (canGoStraightHorizontal(board, row1, col1, c) &&
            canGoStraightVertical(board, c, row1, row2) &&
            canGoStraightHorizontal(board, row2, c, col2)) {
          if (returnPath) {
            const path = [];
            const start1 = Math.min(col1, c);
            const end1 = Math.max(col1, c);
            for (let col = start1; col <= end1; col++) {
              path.push([row1, col]);
            }
            const start2 = Math.min(row1, row2);
            const end2 = Math.max(row1, row2);
            for (let row = start2; row <= end2; row++) {
              if (row !== row1) path.push([row, c]);
            }
            const start3 = Math.min(c, col2);
            const end3 = Math.max(c, col2);
            for (let col = start3; col <= end3; col++) {
              if (col !== c) path.push([row2, col]);
            }
            return path;
          }
          return true;
        }
      }
    }
    
    return false;
  };

  const hasValidMoves = (board) => {
    for (let i = 0; i < board.length; i++) {
      if (board[i].matched) continue;
      for (let j = i + 1; j < board.length; j++) {
        if (board[j].matched) continue;
        if (canConnect(board, i, j)) {
          return true;
        }
      }
    }
    return false;
  };

  const findValidPair = (board) => {
    for (let i = 0; i < board.length; i++) {
      if (board[i].matched) continue;
      for (let j = i + 1; j < board.length; j++) {
        if (board[j].matched) continue;
        if (canConnect(board, i, j)) {
          return [i, j];
        }
      }
    }
    return null;
  };

  const shuffleBoard = async () => {
    if (!gameState) return;
    
    const unmatchedCells = gameState.board
      .map((cell, index) => ({ ...cell, originalIndex: index }))
      .filter(cell => !cell.matched);
    
    for (let i = unmatchedCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unmatchedCells[i], unmatchedCells[j]] = [unmatchedCells[j], unmatchedCells[i]];
    }
    
    const newBoard = [...gameState.board];
    const unmatchedIndices = gameState.board
      .map((cell, index) => ({ matched: cell.matched, index }))
      .filter(item => !item.matched)
      .map(item => item.index);
    
    unmatchedCells.forEach((cell, i) => {
      const targetIndex = unmatchedIndices[i];
      newBoard[targetIndex] = { ...cell, id: targetIndex };
    });
    
    // Update Firebase
    await db.update(`rooms/${roomCode}`, { board: newBoard });
  };

  const showHint = () => {
    if (!gameState || gameState.status !== 'playing') return;
    
    const pair = findValidPair(gameState.board);
    if (pair) {
      setHintCells(pair);
      setTimeout(() => setHintCells([]), 2000);
    }
  };

  // Tạo room
  const createRoom = async () => {
    if (!playerName.trim()) {
      alert('Vui lòng nhập tên!');
      return;
    }
    
    if (!isFirebaseConfigured) {
      alert('⚠️ Chưa cấu hình Firebase!\n\nVui lòng:\n1. Tạo project trên Firebase Console\n2. Copy config vào code\n3. Thử lại');
      return;
    }

    try {
      const code = generateRoomCode();
      const playerId = Date.now().toString();
      const board = generateBoard();
      
      const roomData = {
        board,
        players: {
          [playerId]: { name: playerName, score: 0 }
        },
        status: 'waiting',
        startTime: null,
        createdAt: Date.now()
      };

      await db.set(`rooms/${code}`, roomData);
      
      setRoomCode(code);
      setMyPlayerId(playerId);
      setGameState(roomData); // Set initial state
      setScreen('game');
      
      // Lắng nghe thay đổi
      db.listen(`rooms/${code}`, (data, eventType) => {
        if (data) {
          console.log('Firebase event:', eventType, data);
          
          if (eventType === 'put') {
            // PUT = toàn bộ data
            setGameState(data);
          } else if (eventType === 'patch') {
            // PATCH = chỉ phần thay đổi, cần merge sâu hơn
            setGameState(prevState => {
              const newState = { ...prevState };
              
              // Merge từng field
              Object.keys(data).forEach(key => {
                if (key === 'players' && data.players) {
                  // Merge players object
                  newState.players = {
                    ...prevState.players,
                    ...data.players
                  };
                } else if (key === 'board' && data.board) {
                  // Thay thế board hoàn toàn
                  newState.board = data.board;
                } else {
                  // Các field khác
                  newState[key] = data[key];
                }
              });
              
              return newState;
            });
          }
          
          if (data.startTime && data.status === 'playing') {
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            setTimeLeft(Math.max(0, 180 - elapsed));
          }
        }
      });
    } catch (error) {
      console.error('Create room error:', error);
      alert('Lỗi tạo phòng! Kiểm tra:\n1. Firebase config đúng chưa\n2. Database Rules cho phép write\n3. Console để xem lỗi chi tiết');
    }
  };

  // Join room
  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    if (!isFirebaseConfigured) {
      alert('⚠️ Chưa cấu hình Firebase!\n\nVui lòng:\n1. Tạo project trên Firebase Console\n2. Copy config vào code\n3. Thử lại');
      return;
    }

    try {
      const room = await db.get(`rooms/${roomCode}`);
      
      if (!room) {
        alert('Không tìm thấy phòng! Kiểm tra lại mã phòng.');
        return;
      }

      if (room.status === 'finished') {
        alert('Phòng này đã kết thúc!');
        return;
      }

      const playerId = Date.now().toString();
      
      await db.update(`rooms/${roomCode}/players`, {
        [playerId]: { name: playerName, score: 0 }
      });

      setMyPlayerId(playerId);
      setGameState(room); // Set initial state
      setScreen('game');
      
      // Lắng nghe thay đổi
      db.listen(`rooms/${roomCode}`, (data, eventType) => {
        if (data) {
          console.log('Firebase event:', eventType, data);
          
          if (eventType === 'put') {
            // PUT = toàn bộ data
            setGameState(data);
          } else if (eventType === 'patch') {
            // PATCH = chỉ phần thay đổi, cần merge
            setGameState(prevState => ({
              ...prevState,
              ...data
            }));
          }
          
          if (data.startTime && data.status === 'playing') {
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            setTimeLeft(Math.max(0, 180 - elapsed));
          }
        }
      });
    } catch (error) {
      console.error('Join room error:', error);
      alert('Lỗi join phòng! Kiểm tra:\n1. Mã phòng đúng chưa\n2. Firebase Database Rules\n3. Console để xem lỗi chi tiết');
    }
  };

  // Join room từ danh sách
  const joinRoomFromList = (code) => {
    setRoomCode(code);
    setScreen('join');
  };

  // Bắt đầu game
  const startGame = async () => {
    if (gameState?.status === 'waiting') {
      await db.update(`rooms/${roomCode}`, {
        status: 'playing',
        startTime: Date.now()
      });
    }
  };

  // Xử lý click ô
  const handleCellClick = async (index) => {
    if (!gameState || gameState.status !== 'playing') return;
    if (gameState.board[index].matched) return;
    
    const newSelected = [...selectedCells];
    
    if (newSelected.includes(index)) {
      setSelectedCells(newSelected.filter(i => i !== index));
      return;
    }
    
    newSelected.push(index);
    
    if (newSelected.length === 2) {
      const path = canConnect(gameState.board, newSelected[0], newSelected[1], true);
      if (path) {
        setConnectionPath(path);
        
        setTimeout(async () => {
          const newBoard = [...gameState.board];
          newBoard[newSelected[0]].matched = true;
          newBoard[newSelected[1]].matched = true;
          
          const newPlayers = { ...gameState.players };
          
          // Kiểm tra myPlayerId có tồn tại không
          if (newPlayers[myPlayerId]) {
            newPlayers[myPlayerId].score += 10;
          } else {
            console.error('Player not found:', myPlayerId);
          }
          
          // Update Firebase
          await db.update(`rooms/${roomCode}`, {
            board: newBoard,
            players: newPlayers
          });
          
          setSelectedCells([]);
          setConnectionPath(null);
          
          setTimeout(() => {
            const allMatched = newBoard.every(cell => cell.matched);
            if (allMatched) {
              db.update(`rooms/${roomCode}`, { status: 'finished' });
            } else if (!hasValidMoves(newBoard)) {
              alert('Không còn nước đi! Đang xáo trộn lại...');
              shuffleBoard();
            }
          }, 100);
        }, 300);
      } else {
        setTimeout(() => setSelectedCells([]), 500);
      }
    } else {
      setSelectedCells(newSelected);
    }
  };

  // Timer
  useEffect(() => {
    if (gameState?.status === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameState?.status === 'playing') {
      db.update(`rooms/${roomCode}`, { status: 'finished' });
    }
  }, [timeLeft, gameState, roomCode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (roomCode) {
        db.stopListening(`rooms/${roomCode}`);
      }
    };
  }, [roomCode]);

  // Menu Screen
  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Zap className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Pikachu Online</h1>
            <p className="text-gray-600">Nối đôi - Chơi cùng bạn bè!</p>
          </div>
          
          {!isFirebaseConfigured && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl">
              <p className="text-sm text-red-700 font-semibold mb-2">⚠️ Chưa cấu hình Firebase</p>
              <p className="text-xs text-red-600">
                Vui lòng setup Firebase để chơi online. Xem hướng dẫn bên dưới.
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            <button
              onClick={() => setScreen('create')}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-2"
            >
              <Gamepad2 className="w-5 h-5" />
              Tạo phòng mới
            </button>
            
            <button
              onClick={() => setScreen('join')}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              Tham gia phòng
            </button>
          </div>
          
          {/* Danh sách phòng */}
          {roomList.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white mb-3 text-center">🎮 Phòng đang chơi</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {roomList.map((room) => (
                  <button
                    key={room.code}
                    onClick={() => joinRoomFromList(room.code)}
                    className="w-full bg-white/90 hover:bg-white p-3 rounded-xl transition text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800">#{room.code}</p>
                        <p className="text-xs text-gray-600">
                          {room.playerCount} người chơi • {room.status === 'waiting' ? '⏳ Chờ bắt đầu' : '🎮 Đang chơi'}
                        </p>
                      </div>
                      <div className="text-2xl">
                        {room.status === 'waiting' ? '🟢' : '🔵'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={loadRoomList}
                className="w-full mt-2 bg-white/20 text-white py-2 rounded-xl text-sm hover:bg-white/30 transition"
              >
                🔄 Làm mới
              </button>
            </div>
          )}
          
        </div>
      </div>
    );
  }

  // Create Room Screen
  if (screen === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Tạo phòng chơi</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Tên của bạn</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-gray-800 bg-white"
              />
            </div>
            
            <button
              onClick={createRoom}
              className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold hover:bg-blue-600 transition"
            >
              Tạo phòng
            </button>
            
            <button
              onClick={() => setScreen('menu')}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Join Room Screen
  if (screen === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Tham gia phòng</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Tên của bạn</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-gray-800 bg-white"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Mã phòng</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã phòng..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none uppercase text-gray-800 bg-white"
              />
            </div>
            
            <button
              onClick={joinRoom}
              className="w-full bg-green-500 text-white py-4 rounded-xl font-semibold hover:bg-green-600 transition"
            >
              Tham gia
            </button>
            
            <button
              onClick={() => setScreen('menu')}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game Screen
  if (screen === 'game' && gameState) {
    const playerList = gameState.players ? Object.entries(gameState.players) : [];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-500 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Gamepad2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Mã phòng</p>
                  <p className="text-xl font-bold text-gray-800">{roomCode}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Timer className="w-6 h-6 text-orange-500" />
                <div className="text-3xl font-bold text-gray-800">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={showHint}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-yellow-600 transition flex items-center gap-2"
                >
                  💡 Gợi ý
                </button>
                
                {gameState.status === 'waiting' && (
                  <button
                    onClick={startGame}
                    className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition"
                  >
                    Bắt đầu chơi
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-4">
            {/* Scoreboard */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-2xl shadow-xl p-4">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Bảng điểm
                </h3>
                {playerList.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm">Chưa có người chơi</p>
                ) : (
                  playerList.map(([id, player]) => (
                    <div key={id} className={`p-3 rounded-xl mb-2 ${id === myPlayerId ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 flex items-center gap-1">
                            {player.name}
                            {id === myPlayerId && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">Bạn</span>}
                          </p>
                          <p className="text-2xl font-bold text-blue-600">{player.score} điểm</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Danh sách người chơi */}
              <div className="bg-white rounded-2xl shadow-xl p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" />
                  Người chơi ({playerList.length})
                </h3>
                <div className="space-y-2">
                  {playerList.map(([id, player], index) => (
                    <div key={id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">{player.name}</p>
                        <p className="text-xs text-gray-500">{player.score} điểm</p>
                      </div>
                      {id === myPlayerId && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">You</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {gameState.status === 'waiting' && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4">
                  <p className="text-sm text-gray-700 text-center">
                    ⏳ Đang chờ bắt đầu...<br/>
                    <span className="text-xs">Số người chơi: {playerList.length}</span>
                  </p>
                </div>
              )}
              
              {gameState.status === 'finished' && (
                <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4">
                  <p className="text-lg font-bold text-center text-gray-800 mb-2">
                    🎉 Kết thúc!
                  </p>
                  <p className="text-sm text-gray-700 text-center mb-3">
                    {playerList.sort((a, b) => b[1].score - a[1].score)[0][1].name} chiến thắng!
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Chơi lại
                  </button>
                </div>
              )}
            </div>

            {/* Game Board */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-xl p-2 sm:p-4 md:p-6 relative">
                <div className="grid grid-cols-8 gap-1 sm:gap-2 max-w-2xl mx-auto relative">
                  {/* Vẽ đường nối */}
                  {connectionPath && (
                    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                      <polyline
                        points={connectionPath.map(([row, col]) => {
                          const cellSize = 100 / 8;
                          const x = (col + 0.5) * cellSize;
                          const y = (row + 0.5) * cellSize;
                          return `${x}%,${y}%`;
                        }).join(' ')}
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="animate-pulse"
                      />
                    </svg>
                  )}
                  
                  {gameState.board.map((cell, index) => {
                    const isSelected = selectedCells.includes(index);
                    const isMatched = cell.matched;
                    const isHint = hintCells.includes(index);
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleCellClick(index)}
                        disabled={isMatched || gameState.status !== 'playing'}
                        className={`aspect-square rounded-lg text-2xl sm:text-3xl font-bold transition-all transform hover:scale-105 flex items-center justify-center relative ${
                          isMatched
                            ? 'bg-gray-100 opacity-30 cursor-not-allowed'
                            : isSelected
                            ? 'bg-yellow-300 border-2 sm:border-4 border-yellow-500 scale-110'
                            : isHint
                            ? 'bg-green-300 border-2 sm:border-4 border-green-500 animate-bounce'
                            : 'bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 shadow-lg'
                        }`}
                      >
                        {isMatched ? '' : cell.icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PikachuGame;