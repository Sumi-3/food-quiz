/**
 * カメラ機能を管理するモジュール
 */
export class Camera {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.stream = null;
  }

  /**
   * カメラを起動する
   */
  async start() {
    try {
      // モバイルの場合は背面のカメラを優先する設定
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      this.videoElement.play();
      return true;
    } catch (err) {
      console.error('カメラの起動に失敗しました:', err);
      // fallback to any available camera if environment camera fails
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.videoElement.srcObject = this.stream;
        this.videoElement.play();
        return true;
      } catch (fallbackErr) {
        console.error('カメラへのアクセスが拒否されたか、利用可能なカメラがありません:', fallbackErr);
        throw new Error('カメラを使用できません。権限を確認してください。');
      }
    }
  }

  /**
   * カメラを停止する
   */
  stop() {
    if (this.stream) {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
      this.stream = null;
    }
  }

  /**
   * 写真を撮影し、リサイズして返す
   * @returns {Promise<{base64: string, blob: Blob, mimeType: string}>}
   */
  async capture() {
    if (!this.stream) {
      throw new Error('カメラが起動していません');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 現在のビデオのサイズを取得
    const videoWidth = this.videoElement.videoWidth;
    const videoHeight = this.videoElement.videoHeight;
    
    // 最大1024pxにリサイズ（APIコスト削減と送信速度向上のため）
    const maxSize = 1024;
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;
    
    if (videoWidth > maxSize || videoHeight > maxSize) {
      if (videoWidth > videoHeight) {
        targetWidth = maxSize;
        targetHeight = Math.floor(videoHeight * (maxSize / videoWidth));
      } else {
        targetHeight = maxSize;
        targetWidth = Math.floor(videoWidth * (maxSize / videoHeight));
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // キャンバスに描画（リサイズ実行）
    ctx.drawImage(this.videoElement, 0, 0, targetWidth, targetHeight);
    
    const mimeType = 'image/jpeg';
    
    // Base64形式で取得
    const base64DataUrl = canvas.toDataURL(mimeType, 0.8);
    // プレフィックスを削除して純粋なBase64文字列にする
    const base64 = base64DataUrl.split(',')[1];
    
    // Blob形式で取得（プロミスでラップ）
    const blob = await new Promise(resolve => {
      canvas.toBlob(b => resolve(b), mimeType, 0.8);
    });

    return { base64, blob, mimeType };
  }
}
