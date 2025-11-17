import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Users, Trophy, Timer, Zap, RefreshCw, Copy, LogOut, Shuffle, Maximize, Minimize, MessageSquare, X } from 'lucide-react';

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
      if (data.data) callback(data.data, 'put');
    });

    eventSource.addEventListener('patch', (e) => {
      const data = JSON.parse(e.data);
      if (data.data) callback(data.data, 'patch');
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
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // default 5 phút = 300s
  const [connectionPath, setConnectionPath] = useState<any>(null);
  const [hintCells, setHintCells] = useState<number[]>([]);
  const [roomList, setRoomList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  const [iconCount, setIconCount] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gridSize, setGridSize] = useState(20);

  // NEW: time limit minutes setting on create screen
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(5); // default 5 phút

  // Chat states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const MAX_CHAT_MESSAGES = 200; // chứa tối đa 200 tin nhắn cục bộ hiển thị

  const icons = ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐙', '🦀', '🐠', '🐟', '🦈', '🐡', '🦐', '🦑', '🐢', '🦎', '🐊', '🦖', '🦕', '🐉', '🦅', '🦉', '🦋', '🐌', '🐛', '🐝', '🐞', '🦗', '🕷️', '🦂', '🦟', '🦠', '🐍', '🦎', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'];

  useEffect(() => {
    loadRoomList();
    const savedName = localStorage.getItem('playerName');
    if (savedName) setPlayerName(savedName);
  }, []);
  

  const showNotification = (message: string, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Tự động dọn phòng sau 30 phút không hoạt động
  useEffect(() => {
    if (gameState?.status === 'waiting') {
      const timer = setTimeout(() => {
        db.set(`rooms/${roomCode}`, null); // xóa phòng
      }, 30 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.status]);

  // generateBoard now accepts optional size
  const generateBoard = (sizeParam?: number) => {
    const size = sizeParam || gridSize;
    const totalCells = size * size;
    const maxPairs = Math.floor(totalCells / 2);

    const actualPairs = Math.min(iconCount, maxPairs, icons.length);

    const pairs: any[] = [];
    const usedIcons = icons.slice(0, actualPairs);

    // create pairs
    for (let i = 0; i < actualPairs; i++) {
      const icon = usedIcons[i];
      pairs.push({ id: i * 2, icon, matched: false });
      pairs.push({ id: i * 2 + 1, icon, matched: false });
    }

    // shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    // fill empties
    while (pairs.length < totalCells) {
      pairs.push({ id: pairs.length, icon: '', matched: true, isEmpty: true });
    }

    // ensure length = totalCells
    pairs.length = totalCells;
    return pairs;
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  // Helper: coi ô "free" (có thể đi qua) là ô không tồn tại / là isEmpty / đã matched
  const isFree = (cell: any) => !cell || cell.isEmpty || cell.matched;

  const canGoStraightHorizontal = (board: any[], row: number, col1: number, col2: number, size: number, returnPath = false) => {
    const start = Math.min(col1, col2);
    const end = Math.max(col1, col2);
    for (let c = start + 1; c < end; c++) {
      const idx = row * size + c;
      const cell = board[idx];
      if (!isFree(cell)) return false;
    }
    if (returnPath) {
      const path: number[][] = [];
      for (let c = start; c <= end; c++) path.push([row, c]);
      return path as any;
    }
    return true;
  };

  const canGoStraightVertical = (board: any[], col: number, row1: number, row2: number, size: number, returnPath = false) => {
    const start = Math.min(row1, row2);
    const end = Math.max(row1, row2);
    for (let r = start + 1; r < end; r++) {
      const idx = r * size + col;
      const cell = board[idx];
      if (!isFree(cell)) return false;
    }
    if (returnPath) {
      const path: number[][] = [];
      for (let r = start; r <= end; r++) path.push([r, col]);
      return path as any;
    }
    return true;
  };

  const canConnect = (board: any[], pos1: number, pos2: number, returnPath = false) => {
    if (pos1 === pos2) return false;
    if (!board || pos1 < 0 || pos2 < 0 || pos1 >= board.length || pos2 >= board.length) return false;

    const cell1 = board[pos1];
    const cell2 = board[pos2];
    if (!cell1 || !cell2) return false;
    if (cell1.icon !== cell2.icon) return false;
    if (cell1.matched || cell2.matched || cell1.isEmpty || cell2.isEmpty) return false;

    const size = Math.round(Math.sqrt(board.length));
    const row1 = Math.floor(pos1 / size);
    const col1 = pos1 % size;
    const row2 = Math.floor(pos2 / size);
    const col2 = pos2 % size;

    // same row
    if (row1 === row2) {
      const res = canGoStraightHorizontal(board, row1, col1, col2, size, returnPath);
      if (res) return res;
    }

    // same column
    if (col1 === col2) {
      const res = canGoStraightVertical(board, col1, row1, row2, size, returnPath);
      if (res) return res;
    }

    // one corner
    const corner1Idx = row1 * size + col2;
    const corner2Idx = row2 * size + col1;

    if ((isFree(board[corner1Idx]) || corner1Idx === pos1 || corner1Idx === pos2)) {
      if (
        canGoStraightHorizontal(board, row1, col1, col2, size) &&
        canGoStraightVertical(board, col2, row1, row2, size)
      ) {
        if (returnPath) {
          const path: number[][] = [];
          const startC = Math.min(col1, col2);
          const endC = Math.max(col1, col2);
          for (let c = startC; c <= endC; c++) path.push([row1, c]);
          const startR = Math.min(row1, row2);
          const endR = Math.max(row1, row2);
          for (let r = startR; r <= endR; r++) {
            if (r !== row1) path.push([r, col2]);
          }
          return path as any;
        }
        return true;
      }
    }

    if ((isFree(board[corner2Idx]) || corner2Idx === pos1 || corner2Idx === pos2)) {
      if (
        canGoStraightVertical(board, col1, row1, row2, size) &&
        canGoStraightHorizontal(board, row2, col1, col2, size)
      ) {
        if (returnPath) {
          const path: number[][] = [];
          const startR = Math.min(row1, row2);
          const endR = Math.max(row1, row2);
          for (let r = startR; r <= endR; r++) path.push([r, col1]);
          const startC = Math.min(col1, col2);
          const endC = Math.max(col1, col2);
          for (let c = startC; c <= endC; c++) {
            if (c !== col1) path.push([row2, c]);
          }
          return path as any;
        }
        return true;
      }
    }

    // two-corner (scan rows)
    for (let r = 0; r < size; r++) {
      const mid1 = r * size + col1;
      const mid2 = r * size + col2;

      if ((isFree(board[mid1]) || mid1 === pos1 || mid1 === pos2) &&
          (isFree(board[mid2]) || mid2 === pos1 || mid2 === pos2)) {
        if (
          canGoStraightVertical(board, col1, row1, r, size) &&
          canGoStraightHorizontal(board, r, col1, col2, size) &&
          canGoStraightVertical(board, col2, r, row2, size)
        ) {
          if (returnPath) {
            const path: number[][] = [];
            const s1 = Math.min(row1, r);
            const e1 = Math.max(row1, r);
            for (let rr = s1; rr <= e1; rr++) path.push([rr, col1]);
            const s2 = Math.min(col1, col2);
            const e2 = Math.max(col1, col2);
            for (let cc = s2; cc <= e2; cc++) {
              if (cc !== col1) path.push([r, cc]);
            }
            const s3 = Math.min(r, row2);
            const e3 = Math.max(r, row2);
            for (let rr = s3; rr <= e3; rr++) {
              if (rr !== r) path.push([rr, col2]);
            }
            return path as any;
          }
          return true;
        }
      }
    }

    // two-corner (scan cols)
    for (let c = 0; c < size; c++) {
      const mid1 = row1 * size + c;
      const mid2 = row2 * size + c;

      if ((isFree(board[mid1]) || mid1 === pos1 || mid1 === pos2) &&
          (isFree(board[mid2]) || mid2 === pos1 || mid2 === pos2)) {
        if (
          canGoStraightHorizontal(board, row1, col1, c, size) &&
          canGoStraightVertical(board, c, row1, row2, size) &&
          canGoStraightHorizontal(board, row2, c, col2, size)
        ) {
          if (returnPath) {
            const path: number[][] = [];
            const s1 = Math.min(col1, c);
            const e1 = Math.max(col1, c);
            for (let cc = s1; cc <= e1; cc++) path.push([row1, cc]);
            const s2 = Math.min(row1, row2);
            const e2 = Math.max(row1, row2);
            for (let rr = s2; rr <= e2; rr++) {
              if (rr !== row1) path.push([rr, c]);
            }
            const s3 = Math.min(c, col2);
            const e3 = Math.max(c, col2);
            for (let cc = s3; cc <= e3; cc++) {
              if (cc !== c) path.push([row2, cc]);
            }
            return path as any;
          }
          return true;
        }
      }
    }

    return false;
  };


  const hasValidMoves = (board: any[]) => {
    for (let i = 0; i < board.length; i++) {
      const cell = board[i];
      if (!cell || cell.matched || cell.isEmpty) continue;
      for (let j = i + 1; j < board.length; j++) {
        const cell2 = board[j];
        if (!cell2 || cell2.matched || cell2.isEmpty) continue;
        if (canConnect(board, i, j)) return true;
      }
    }
    return false;
  };

  const findValidPair = (board: any[]) => {
    for (let i = 0; i < board.length; i++) {
      const cell = board[i];
      if (!cell || cell.matched || cell.isEmpty) continue;
      for (let j = i + 1; j < board.length; j++) {
        const cell2 = board[j];
        if (!cell2 || cell2.matched || cell2.isEmpty) continue;
        if (canConnect(board, i, j)) return [i, j];
      }
    }
    return null;
  };

  const shuffleBoard = async () => {
    if (!gameState) return;
    
    const unmatchedCells = gameState.board
      .map((cell: any, index: number) => ({ ...cell, originalIndex: index }))
      .filter((cell: any) => !cell.matched && !cell.isEmpty);
    
    for (let i = unmatchedCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unmatchedCells[i], unmatchedCells[j]] = [unmatchedCells[j], unmatchedCells[i]];
    }
    
    const newBoard = [...gameState.board];
    const unmatchedIndices = gameState.board
      .map((cell: any, index: number) => ({ matched: cell.matched, isEmpty: cell.isEmpty, index }))
      .filter((item: any) => !item.matched && !item.isEmpty)
      .map((item: any) => item.index);
    
    unmatchedCells.forEach((cell: any, i: number) => {
      const targetIndex = unmatchedIndices[i];
      newBoard[targetIndex] = { ...cell, id: targetIndex };
    });
    
    await db.update(`rooms/${roomCode}`, { board: newBoard });
    showNotification('Đã xáo trộn bàn chơi!', 'success');
  };

  const showHint = () => {
    if (!gameState || gameState.status !== 'playing') return;
    const pair = findValidPair(gameState.board);
    if (pair) {
      setHintCells(pair);
      setTimeout(() => setHintCells([]), 2000);
      showNotification('💡 Gợi ý đã hiển thị', 'info');
    } else {
      showNotification('Không có nước đi khả dụng', 'warning');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
        showNotification('Đã bật chế độ toàn màn hình', 'success');
      }).catch(() => {
        showNotification('Không thể bật toàn màn hình', 'error');
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        showNotification('Đã thoát chế độ toàn màn hình', 'info');
      });
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}?join=${roomCode}`;
    navigator.clipboard.writeText(link);
    showNotification('Đã copy link phòng!', 'success');
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      showNotification('Vui lòng nhập tên!', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const code = generateRoomCode();
      const playerId = Date.now().toString();
      const board = generateBoard(gridSize);
      
      localStorage.setItem('playerName', playerName);
      
      const roomData = {
        board,
        players: {
          [playerId]: { name: playerName, score: 0 }
        },
        status: 'waiting',
        startTime: null,
        createdAt: Date.now(),
        iconCount: iconCount,
        gridSize: gridSize,
        timeLimit: timeLimitMinutes * 60, // <-- lưu time limit (giây)
        chat: {} // khởi tạo chat rỗng
      };

      await db.set(`rooms/${code}`, roomData);
      
      setRoomCode(code);
      setMyPlayerId(playerId);
      setGameState(roomData);
      setGridSize(gridSize);
      setTimeLeft(roomData.timeLimit || 300); // sync local timer
      setChatMessages([]); // clear local chat
      setScreen('game');
      
      db.listen(`rooms/${code}`, (data: any, eventType: string) => {
        console.log('[ES] event', eventType, data);

        if (data) {
          if (eventType === 'put') {
            setGameState(data);
          } else if (eventType === 'patch') {
            setGameState(prevState => {
              const newState = { ...prevState };
              Object.keys(data).forEach(key => {
                if (key === 'players' && data.players) {
                  newState.players = { ...prevState.players, ...data.players };
                } else if (key === 'board' && data.board) {
                  newState.board = data.board;
                } else if (key === 'chat' && data.chat) {
                  // merge chat safely
                  newState.chat = { ...prevState.chat, ...data.chat };
                } else {
                  newState[key] = data[key];
                }
              });
              return newState;
            });
          }
          
          if (data.chat) {
            // transform object -> sorted array
            const arr = Object.values(data.chat || {}).filter(Boolean).sort((a: any, b: any) => a.ts - b.ts);
            setChatMessages(prev => {
              // merge unique by id
              const map = new Map(prev.map((m: any) => [m.id, m]));
              arr.forEach((m: any) => map.set(m.id, m));
              const merged = Array.from(map.values()).sort((a: any, b: any) => a.ts - b.ts);
              // trim to MAX_CHAT_MESSAGES
              return merged.slice(Math.max(0, merged.length - MAX_CHAT_MESSAGES));
            });
          }
          
          if (data.startTime && data.status === 'playing') {
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            const limit = data.timeLimit || 300;
            setTimeLeft(Math.max(0, limit - elapsed));
          }
        }
      });
      
      showNotification('Tạo phòng thành công!', 'success');
    } catch (error) {
      console.error('Create room error:', error);
      showNotification('Lỗi tạo phòng!', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoomList = async () => {
    try {
      const rooms = await db.get('rooms');
      if (rooms) {
        const roomArray = Object.entries(rooms)
          .map(([code, data]: any) => ({
            code,
            ...data,
            playerCount: data.players ? Object.keys(data.players).length : 0
          }))
          .filter(room => room.status !== 'finished')
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 10);
        setRoomList(roomArray);
      }
    } catch (error) {
      console.error('Load room list error:', error);
    }
  };

  const joinRoom = async (code = roomCode) => {
    // Thêm vào createRoom / joinRoom
    // guard: if no room loaded (we use server value)
    if (!code) {
      showNotification('Vui lòng nhập mã phòng!', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const room = await db.get(`rooms/${code}`);
      
      if (!room) {
        showNotification('Không tìm thấy phòng!', 'error');
        setIsLoading(false);
        return;
      }

      if (room.status === 'finished') {
        showNotification('Phòng này đã kết thúc!', 'error');
        setIsLoading(false);
        return;
      }

      // check players capacity
      if (room.players && Object.keys(room.players).length >= 8) {
        showNotification('Phòng đã đầy!', 'error');
        setIsLoading(false);
        return;
      }

      if (!playerName.trim()) {
        showNotification('Vui lòng nhập tên!', 'error');
        setIsLoading(false);
        return;
      }

      const playerId = Date.now().toString();
      
      localStorage.setItem('playerName', playerName);
      
      await db.update(`rooms/${code}/players`, {
        [playerId]: { name: playerName, score: 0 }
      });

      setMyPlayerId(playerId);
      setGameState(room);
      setRoomCode(code);
      setGridSize(room.gridSize || 8);
      setTimeLeft(room.timeLimit || 300);
      // load chat from room
      const chatObj = room.chat || {};
      const chatArr = Object.values(chatObj).filter(Boolean).sort((a: any, b: any) => a.ts - b.ts);
      setChatMessages(chatArr.slice(Math.max(0, chatArr.length - MAX_CHAT_MESSAGES)));
      setScreen('game');
      
      db.listen(`rooms/${code}`, (rawData, eventType) => {
        if (!rawData) return;
        const data = eventType === 'patch' ? normalizePatchData(rawData) : rawData;
      
        // merge chat if present
        if (data.chat) {
          const arr = Object.values(data.chat || {}).filter(Boolean).sort((a: any, b: any) => a.ts - b.ts);
          setChatMessages(prev => {
            const map = new Map(prev.map((m: any) => [m.id, m]));
            arr.forEach((m: any) => map.set(m.id, m));
            const merged = Array.from(map.values()).sort((a: any, b: any) => a.ts - b.ts);
            return merged.slice(Math.max(0, merged.length - MAX_CHAT_MESSAGES));
          });
        }
      
        // merge the rest into gameState similar như trước
        if (eventType === 'put') {
          setGameState(data);
        } else if (eventType === 'patch') {
          setGameState(prevState => {
            const newState = { ...prevState };
            Object.keys(data).forEach(key => {
              if (key === 'players' && data.players) {
                newState.players = { ...prevState.players, ...data.players };
              } else if (key === 'board' && data.board) {
                newState.board = data.board;
              } else if (key === 'chat' && data.chat) {
                newState.chat = { ...prevState.chat, ...data.chat };
              } else {
                newState[key] = data[key];
              }
            });
            return newState;
          });
        }
      });
      
      
      showNotification('Vào phòng thành công!', 'success');
    } catch (error) {
      console.error('Join room error:', error);
      showNotification('Lỗi join phòng!', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = async () => {
    if (gameState?.status === 'waiting') {
      const limit = gameState.timeLimit || 300;
      const startTime = Date.now();
      await db.update(`rooms/${roomCode}`, {
        status: 'playing',
        startTime
      });
      setTimeLeft(limit);
      showNotification('Game bắt đầu!', 'success');
    }
  };

  // NEW: playAgain - tạo ván mới, reset điểm, set status playing (bắt đầu ván mới ngay)
  const playAgain = async () => {
    if (!gameState) return;
    const size = gameState.gridSize || gridSize;
    const newBoard = generateBoard(size);

    // reset players' scores to 0 (preserve names and ids)
    const newPlayers: any = {};
    Object.keys(gameState.players || {}).forEach((pid) => {
      newPlayers[pid] = { ...(gameState.players[pid]), score: 0 };
    });

    const startTime = Date.now();
    const limit = gameState.timeLimit || 300;

    await db.update(`rooms/${roomCode}`, {
      board: newBoard,
      players: newPlayers,
      status: 'playing',
      startTime
    });

    setTimeLeft(limit);
    setSelectedCells([]);
    setConnectionPath(null);
    setHintCells([]);
    showNotification('Bắt đầu ván mới!', 'success');
  };

  const handleCellClick = async (index: number) => {
    if (!gameState || gameState.status !== 'playing') return;
    const cell = gameState.board[index];
    if (!cell || cell.matched || cell.isEmpty) return;
    
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
          
          if (newPlayers[myPlayerId]) {
            newPlayers[myPlayerId].score += 10;
          }
          
          await db.update(`rooms/${roomCode}`, {
            board: newBoard,
            players: newPlayers
          });
          
          setSelectedCells([]);
          setConnectionPath(null);
          
          setTimeout(() => {
            const allMatched = newBoard.every((cell: any) => !cell || cell.matched || cell.isEmpty);
            if (allMatched) {
              db.update(`rooms/${roomCode}`, { status: 'finished' });
              showNotification('Game kết thúc!', 'success');
            } else if (!hasValidMoves(newBoard)) {
              showNotification('Không còn nước đi! Đang xáo trộn...', 'warning');
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

  const leaveRoom = () => {
    if (roomCode) {
      db.stopListening(`rooms/${roomCode}`);
    }
    setScreen('menu');
    setGameState(null);
    setRoomCode('');
    setSelectedCells([]);
    setConnectionPath(null);
    setHintCells([]);
    setChatMessages([]);
  };

  useEffect(() => {
    if (gameState?.status === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameState?.status === 'playing') {
      db.update(`rooms/${roomCode}`, { status: 'finished' });
    }
  }, [timeLeft, gameState, roomCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setRoomCode(joinCode);
      setScreen('join');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (roomCode) {
        db.stopListening(`rooms/${roomCode}`);
      }
    };
  }, [roomCode]);

    // helper nhỏ: nếu payload có keys chứa '/', convert thành nested object
  const normalizePatchData = (patchData: any) => {
    const result: any = {};
    Object.keys(patchData).forEach((key) => {
      const val = patchData[key];
      if (key.includes('/')) {
        // ex: "chat/1634_abcd" => ['chat','1634_abcd']
        const parts = key.split('/');
        // We'll only handle one-level nesting like chat/<id>
        const top = parts[0];
        const sub = parts.slice(1).join('/');
        result[top] = result[top] || {};
        result[top][sub] = val;
      } else {
        result[key] = val;
      }
    });
    return result;
  };


// Replace existing sendChatMessage with this safe version
    const sendChatMessage = async () => {
      if (!chatInput.trim()) return;
      if (!roomCode) return;

      const id = `${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
      const msg = {
        id,
        senderId: myPlayerId,
        senderName: playerName,
        text: chatInput.trim(),
        ts: Date.now()
      };

      try {
        // ====== SAFE UPDATE: patch vào child 'chat' (không ghi đè node rooms/{roomCode}) ======
        // Using update to /rooms/{roomCode}/chat with payload { [id]: msg }
        await db.update(`rooms/${roomCode}/chat`, { [id]: msg });

        // optimistic local update (no reliance on gameState)
        setChatInput('');
        setChatMessages(prev => {
          const merged = [...prev, msg];
          // trim to max
          const start = Math.max(0, merged.length - MAX_CHAT_MESSAGES);
          const sliced = merged.slice(start);
          // scroll after a tick
          setTimeout(() => {
            chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
          }, 20);
          return sliced;
        });

        console.log('[chat] sent msg', msg);
      } catch (err) {
        console.error('Send chat error', err);
        showNotification('Gửi tin nhắn thất bại', 'error');
      }
    };



  // scroll to bottom when chatMessages changes
  useEffect(() => {
    setTimeout(() => {
      if (chatOpen) chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, [chatMessages, chatOpen]);

  const renderChatBox = () => {
    return (
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
        {/* Chat toggle button */}
        {/* Chat popup */}
        {chatOpen && (
          <div className="w-80 md:w-96 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-700" />
                <div>
                  <div className="text-sm font-semibold text-gray-800">Chat phòng {roomCode}</div>
                  <div className="text-xs text-gray-500">{(gameState?.players ? Object.keys(gameState.players).length : 0)} người</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setChatOpen(false); }} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div ref={chatListRef} className="p-3 overflow-y-auto" style={{ maxHeight: 220 }}>
              {chatMessages.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-8">Chưa có tin nhắn</div>
              ) : (
                chatMessages.map((m: any) => (
                  <div key={m.id} className={`mb-2 flex ${m.senderId === myPlayerId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`${m.senderId === myPlayerId ? 'bg-blue-100 text-gray-900' : 'bg-gray-100 text-gray-900'} rounded-lg px-3 py-2 max-w-[80%]`}>
                      <div className="text-xs text-gray-600 mb-1">{m.senderName} • {new Date(m.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      <div className="text-sm break-words">{m.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-3 py-2 border-t flex gap-2 items-center">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChatMessage(); }}
                placeholder="Gửi tin nhắn..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-gray-800 bg-white"
              />
              <button
                onClick={sendChatMessage}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                Gửi
              </button>
            </div>
          </div>
        )}

        <div className="mt-2">
          <button
            onClick={() => setChatOpen(v => !v)}
            className="bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition flex items-center gap-2"
            title="Chat phòng"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="hidden sm:inline">Chat</span>
          </button>
        </div>
      </div>
    );
  };

  const gridSizeGame = gameState?.gridSize || 8;
  let gridSizeClass: string | undefined = undefined;
  
  if(gridSizeGame > 15){
    gridSizeClass = ``
  }else if(gridSizeGame > 12){
    gridSizeClass = `max-w-5xl`
  } else if(gridSizeGame > 10){
    gridSizeClass = `max-w-3xl`
  } else {
    gridSizeClass = 'max-w-2xl'
  }

  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 ${
            notification.type === 'success' ? 'bg-green-500' : 
            notification.type === 'error' ? 'bg-red-500' : 
            notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
          } text-white font-semibold`}>
            {notification.message}
          </div>
        )}
        
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Zap className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Pikachu Online</h1>
            <p className="text-gray-600">Nối đôi - Chơi cùng bạn bè!</p>
          </div>
          
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
          
          {roomList.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-700 mb-3 text-center">🎮 Phòng đang chơi</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {roomList.map((room) => (
                  <button
                    key={room.code}
                    onClick={() => {
                      setRoomCode(room.code);
                      setScreen('join');
                    }}
                    className="w-full bg-gray-50 hover:bg-gray-100 p-3 rounded-xl transition text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800">#{room.code}</p>
                        <p className="text-xs text-gray-600">
                          {room.playerCount} người • {room.status === 'waiting' ? '⏳ Chờ' : '🎮 Chơi'}
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
                className="w-full mt-2 bg-gray-200 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-300 transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
            </div>
          )}
        </div>

        {/* Chat toggle on menu too (optional) */}
        {renderChatBox()}
      </div>
    );
  }

  if (screen === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 ${
            notification.type === 'success' ? 'bg-green-500' : 
            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          } text-white font-semibold`}>
            {notification.message}
          </div>
        )}
        
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
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Số loại nhân vật: {iconCount}
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">2</span>
                <input
                  type="range"
                  min="2"
                  max="100"
                  value={iconCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value);
                    setIconCount(count);
                  }}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-600">100</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Mỗi nhân vật có 2 ô → Tổng: {iconCount * 2} ô cần ghép
              </p>
            </div>
            
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Kích thước bàn chơi: {gridSize}x{gridSize}
              </label>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-gray-800 bg-white"
                disabled={isLoading}
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(size => {
                  const totalCells = size * size;
                  const maxPairs = Math.floor(totalCells / 2);
                  const isDisabled = iconCount > maxPairs;
                  return (
                    <option key={size} value={size} disabled={isDisabled}>
                      {size}x{size} ({totalCells} ô - Max {maxPairs} nhân vật) {isDisabled ? '⚠️ Quá nhỏ' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Diện tích: {gridSize * gridSize} ô | Cần: {iconCount * 2} ô | Tối đa: {Math.floor(gridSize * gridSize / 2)} nhân vật
                {iconCount * 2 > gridSize * gridSize && (
                  <span className="text-red-500 font-semibold block mt-1"> ⚠️ Bàn chơi quá nhỏ! Cần ít nhất {Math.ceil(Math.sqrt(iconCount * 2))}x{Math.ceil(Math.sqrt(iconCount * 2))}</span>
                )}
              </p>
            </div>

            {/* NEW: Time limit selector */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Thời gian mỗi ván: {timeLimitMinutes} phút
              </label>
              <select
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-gray-800 bg-white"
                disabled={isLoading}
              >
                {Array.from({ length: 60 }, (_, i) => i + 1).map((min) => (
                  <option key={min} value={min}>
                    {min} phút
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Mặc định: 5 phút. Chọn từ 1 đến 60 phút cho mỗi ván.
              </p>
            </div>
            
            <button
              onClick={createRoom}
              disabled={isLoading || iconCount * 2 > gridSize * gridSize}
              className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Đang tạo...' : 
               iconCount * 2 > gridSize * gridSize ? '⚠️ Chọn bàn chơi lớn hơn' : 
               'Tạo phòng'}
            </button>
            
            <button
              onClick={() => setScreen('menu')}
              disabled={isLoading}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
            >
              Quay lại
            </button>
          </div>
        </div>

        {renderChatBox()}
      </div>
    );
  }

  if (screen === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 ${
            notification.type === 'success' ? 'bg-green-500' : 
            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          } text-white font-semibold`}>
            {notification.message}
          </div>
        )}
        
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
                disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>
            
            <button
              onClick={() => joinRoom()}
              disabled={isLoading}
              className="w-full bg-green-500 text-white py-4 rounded-xl font-semibold hover:bg-green-600 transition disabled:opacity-50"
            >
              {isLoading ? 'Đang join...' : 'Tham gia'}
            </button>
            
            <button
              onClick={() => setScreen('menu')}
              disabled={isLoading}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
            >
              Quay lại
            </button>
          </div>
        </div>

        {renderChatBox()}
      </div>
    );
  }

  if (screen === 'game' && gameState) {
    const playerList = gameState.players ? Object.entries(gameState.players) : [];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-500 p-4">
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 ${
            notification.type === 'success' ? 'bg-green-500' : 
            notification.type === 'error' ? 'bg-red-500' : 
            notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
          } text-white font-semibold`}>
            {notification.message}
          </div>
        )}
        
        <div className="max-w-full mx-auto">
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
                <div className="text-xs text-gray-500">
                  / {(gameState.timeLimit ? Math.round(gameState.timeLimit / 60) : 5)} phút
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={toggleFullscreen}
                  className="bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-600 transition flex items-center gap-2"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  {isFullscreen ? 'Thu nhỏ' : 'Toàn màn'}
                </button>
                
                <button
                  onClick={copyRoomLink}
                  className="bg-purple-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-purple-600 transition flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                
                <button
                  onClick={showHint}
                  disabled={gameState.status !== 'playing'}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-yellow-600 transition flex items-center gap-2 disabled:opacity-50"
                >
                  💡 Gợi ý
                </button>
                
                {gameState.status === 'playing' && (
                  <button
                    onClick={shuffleBoard}
                    className="bg-orange-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-orange-600 transition flex items-center gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    Xáo
                  </button>
                )}
                
                {gameState.status === 'waiting' && (
                  <button
                    onClick={startGame}
                    className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition"
                  >
                    Bắt đầu chơi
                  </button>
                )}
                
                <button
                  onClick={leaveRoom}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-red-600 transition flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Thoát
                </button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-2xl shadow-xl p-4">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Bảng điểm
                </h3>
                {playerList.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm">Chưa có người chơi</p>
                ) : (
                  playerList
                    .sort((a: any, b: any) => b[1].score - a[1].score)
                    .map(([id, player]: any, index: number) => (
                      <div key={id} className={`p-3 rounded-xl mb-2 ${id === myPlayerId ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-gray-300'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 flex items-center gap-1">
                                {player.name}
                                {id === myPlayerId && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">Bạn</span>}
                              </p>
                              <p className="text-lg font-bold text-blue-600">{player.score} điểm</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
              
              <div className="bg-white rounded-2xl shadow-xl p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" />
                  Người chơi ({playerList.length})
                </h3>
                <div className="space-y-2">
                  {playerList.map(([id, player]: any) => (
                    <div key={id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {player.name.charAt(0).toUpperCase()}
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
                  {playerList.length > 0 && (
                    <p className="text-sm text-gray-700 text-center mb-3">
                      {playerList.sort((a: any, b: any) => b[1].score - a[1].score)[0][1].name} chiến thắng!
                    </p>
                  )}
                  <button
                    onClick={playAgain} // <- đã sửa: tạo ván mới + reset điểm + reset thời gian
                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Chơi lại
                  </button>
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-xl p-2 sm:p-4 md:p-6 relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600">
                    {gameState.iconCount ? `${gameState.iconCount} loại nhân vật` : '32 nhân vật'} • Bàn {gameState.gridSize || 8}x{gameState.gridSize || 8}
                  </p>
                  <p className="text-sm font-semibold text-blue-600">
                    {(gameState.board ?? []).filter((c: any) => c && c.matched && !c.isEmpty).length}/{(gameState.board ?? []).filter((c: any) => c && !c.isEmpty).length} ô
                  </p>
                </div>
                <div 
                  className={`grid gap-1 sm:gap-2 ${gridSizeClass} mx-auto relative`}
                  style={{ 
                    gridTemplateColumns: `repeat(${gameState.gridSize || 8}, minmax(0, 1fr))` 
                  }}
                >
                  {connectionPath && (
                      <svg
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: '100%', height: '100%' }}
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <polyline
                          points={connectionPath.map(([row, col]: number[]) => {
                            const size = gameState.gridSize || 8;
                            const cellSize = 100 / size;
                            const x = (col + 0.5) * cellSize;
                            const y = (row + 0.5) * cellSize;
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#facc15"
                          strokeWidth={1}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-pulse"
                        />
                      </svg>
                    )}
                  
                  {(gameState.board ?? []).map((cell: any, index: number) => {
                    if (!cell) return null;
                    const isSelected = selectedCells.includes(index);
                    const isMatched = cell.matched;
                    const isHint = hintCells.includes(index);
                    const isEmpty = cell.isEmpty;
                    
                    if (isEmpty) {
                      return (
                        <div
                          key={index}
                          className="aspect-square bg-transparent"
                        />
                      );
                    }
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleCellClick(index)}
                        disabled={isMatched || gameState.status !== 'playing'}
                        className={`aspect-square rounded-lg text-xl sm:text-2xl md:text-3xl font-bold transition-all transform hover:scale-105 flex items-center justify-center relative ${
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

        {/* Chat */}
        {renderChatBox()}
      </div>
    );
  }

  return null;
};

export default PikachuGame;
