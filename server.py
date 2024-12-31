from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import signal
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
import base64
import time
import hmac
import hashlib
import requests
from datetime import datetime
import traceback
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.asr.v20190614 import asr_client, models
from tencentcloud.tts.v20190823 import tts_client, models as tts_models
import cv2
import numpy as np
import dlib
from PIL import Image
import io

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cross-Origin-Isolation', 'same-origin')
        SimpleHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))

            print(f"Received request for: {self.path}")
            print(f"Request data: {request_data}")

            if self.path == '/proxy/face_swap':
                self.proxy_face_swap(request_data)
            elif self.path == '/proxy/baidu/token':
                response_data = self.proxy_baidu_token(request_data)
                self.send_json_response(response_data)
            elif self.path == '/proxy/baidu/asr':
                response_data = self.proxy_baidu_asr(request_data)
                self.send_json_response(response_data)
            elif self.path == '/proxy/baidu/translate':
                response_data = self.proxy_baidu_translate(request_data)
                self.send_json_response(response_data)
            elif self.path == '/proxy/baidu/tts':
                audio_data = self.proxy_baidu_tts(request_data)
                if audio_data:
                    self.send_audio_response(audio_data)
            elif self.path == '/proxy/tencent/asr':
                response_data = self.proxy_tencent_asr(request_data)
                self.send_json_response(response_data)
            elif self.path == '/proxy/tencent/tts':
                audio_data = self.proxy_tencent_tts(request_data)
                if audio_data:
                    self.send_audio_response(audio_data)
                else:
                    # 错误响应已经在 proxy_tencent_tts 中发送
                    return
            else:
                raise Exception(f'Unknown endpoint: {self.path}')

        except Exception as e:
            print(f"Error processing request: {str(e)}")
            self.send_error_response(500, str(e))

    def send_json_response(self, data):
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if data is None:
                self.wfile.write(json.dumps({'error': 'No data'}).encode())
            else:
                self.wfile.write(json.dumps(data).encode())
        except Exception as e:
            print(f"Error sending JSON response: {str(e)}")
            traceback.print_exc()
            self.send_error_response(500, f"Error sending response: {str(e)}")

    def send_audio_response(self, audio_data):
        try:
            if not audio_data:
                raise Exception("No audio data to send")
                
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Content-Length', len(audio_data))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(audio_data)
            print(f"Audio response sent successfully, size: {len(audio_data)} bytes")
        except Exception as e:
            print(f"Error sending audio response: {str(e)}")
            traceback.print_exc()
            self.send_error_response(500, f"Error sending audio response: {str(e)}")

    def proxy_baidu_token(self, data):
        url = f"https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={data['api_key']}&client_secret={data['secret_key']}"
        print(f"Requesting token from: {url}")
        response = urllib.request.urlopen(url)
        return json.loads(response.read().decode())

    def proxy_baidu_asr(self, data):
        url = "https://vop.baidu.com/server_api"
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        request_body = {
            'format': data['format'],
            'rate': data['rate'],
            'channel': data['channel'],
            'token': data['token'],
            'speech': data['speech'],
            'len': data['len'],
            'cuid': data['cuid'],
            'dev_pid': data.get('dev_pid', 1537),
            'version': data.get('version', '3.0')
        }
        
        print(f"ASR request body: {request_body}")
        
        request = urllib.request.Request(
            url,
            data=json.dumps(request_body).encode(),
            headers=headers,
            method='POST'
        )
        
        try:
            response = urllib.request.urlopen(request)
            result = json.loads(response.read().decode())
            print(f"ASR response: {result}")
            return result
        except urllib.error.HTTPError as e:
            error_message = e.read().decode()
            print(f"ASR API error: {error_message}")
            raise Exception(f"ASR API error: {error_message}")

    def proxy_baidu_translate(self, data):
        url = "https://api.fanyi.baidu.com/api/trans/vip/translate"
        params = urllib.parse.urlencode(data)
        full_url = f"{url}?{params}"
        print(f"Translate URL: {full_url}")
        response = urllib.request.urlopen(full_url)
        return json.loads(response.read().decode())

    def proxy_baidu_tts(self, data):
        url = "https://tsn.baidu.com/text2audio"
        params = urllib.parse.urlencode(data)
        response = urllib.request.urlopen(f"{url}?{params}")
        return response.read()

    def proxy_tencent_asr(self, data):
        try:
            # 准备请求参数
            audio_data = data['audio']
            config = data['config']

            try:
                # 实例化一个认证对象
                cred = credential.Credential(
                    config['secretId'],
                    config['secretKey']
                )
                
                # 实例化一个http选项
                httpProfile = HttpProfile()
                httpProfile.endpoint = "asr.tencentcloudapi.com"
                
                # 实例化一个client选项
                clientProfile = ClientProfile()
                clientProfile.httpProfile = httpProfile
                clientProfile.signMethod = "TC3-HMAC-SHA256"
                
                # 实例化要请求产品的client对象
                client = asr_client.AsrClient(cred, config['region'], clientProfile)
                
                # 实例化一个请求对象
                req = models.SentenceRecognitionRequest()
                
                # 组装请求参数
                params = {
                    "ProjectId": 0,
                    "SubServiceType": 2,
                    "EngSerViceType": "16k_zh",
                    "SourceType": 1,
                    "VoiceFormat": "wav",
                    "UsrAudioKey": str(int(time.time())),
                    "Data": audio_data,
                    "DataLen": len(audio_data),
                    "FilterDirty": 0,
                    "FilterModal": 0,
                    "FilterPunc": 0,
                    "ConvertNumMode": 1
                }
                
                print("ASR Request Params:", {k:v for k,v in params.items() if k != 'Data'})
                
                req.from_json_string(json.dumps(params))
                
                # 发起请求并处理响应
                try:
                    # 调用接口，返回 json 格式的字符串
                    response = client.SentenceRecognition(req)
                    print("ASR Response:", response.to_json_string())
                    
                    # 将响应转换为字典
                    result = json.loads(response.to_json_string())
                    return result
                    
                except TencentCloudSDKException as err:
                    print("Tencent Cloud SDK Error:", err)
                    return {
                        'error': {
                            'code': err.code,
                            'message': err.message
                        }
                    }
                    
            except Exception as e:
                print("Error initializing Tencent Cloud client:", str(e))
                return {
                    'error': {
                        'code': 500,
                        'message': f'Failed to initialize Tencent Cloud client: {str(e)}'
                    }
                }
                
        except Exception as e:
            print(f"Tencent ASR error: {str(e)}")
            traceback.print_exc()
            return {
                'error': {
                    'code': 500,
                    'message': str(e)
                }
            }

    def proxy_tencent_tts(self, data):
        try:
            # 准备请求参数
            if 'text' not in data:
                raise Exception('Missing required parameter: text')
            if 'config' not in data:
                raise Exception('Missing required parameter: config')
            if not isinstance(data['text'], str):
                raise Exception('Parameter text must be a string')
            if not isinstance(data['config'], dict):
                raise Exception('Parameter config must be a dictionary')
                
            text = data['text'].strip()
            config = data['config']
            
            print(f"TTS Request - Text: '{text[:100]}...'")  # 只打印前100个字符
            print(f"TTS Config: {config}")
            
            # 验证配置参数
            required_config = ['secretId', 'secretKey', 'region']
            for param in required_config:
                if param not in config:
                    raise Exception(f'Missing required config parameter: {param}')
            
            # 实例化一个认证对象
            cred = credential.Credential(
                config['secretId'],
                config['secretKey']
            )
            
            # 实例化一个http选项
            httpProfile = HttpProfile()
            httpProfile.endpoint = "tts.tencentcloudapi.com"
            
            # 实例化一个client选项
            clientProfile = ClientProfile()
            clientProfile.httpProfile = httpProfile
            clientProfile.signMethod = "TC3-HMAC-SHA256"
            
            # 实例化要请求产品的client对象
            client = tts_client.TtsClient(cred, config['region'], clientProfile)
            
            # 实例化一个请求对象
            req = tts_models.TextToVoiceRequest()
            
            # 组装请求参数
            params = {
                "Text": text,
                "SessionId": str(int(time.time())),
                "ModelType": 1,
                "VoiceType": int(config.get('voiceType', 101001)),  # 确保转换为整数
                "Volume": config.get('volume', 5),             # 默认音量
                "Speed": config.get('speed', 1),              # 默认语速
                "ProjectId": config.get('projectId', 0),      # 默认项目ID
                "PrimaryLanguage": 1,                         # 中文
                "SampleRate": 16000,                          # 采样率
                "Codec": config.get('codec', 'wav')           # 音频格式
            }
            
            print(f"TTS Request Params:", params)
            
            req.from_json_string(json.dumps(params))
            
            # 调用接口
            print(f"Calling Tencent TTS API...")
            response = client.TextToVoice(req)
            print(f"TTS Response received")
            
            result = json.loads(response.to_json_string())
            
            if 'Audio' not in result:
                raise Exception('No audio data in response')
            
            # 解码音频数据
            audio_data = base64.b64decode(result['Audio'])
            print(f"Audio data decoded, size: {len(audio_data)} bytes")
            
            return audio_data
                
        except TencentCloudSDKException as err:
            print("Tencent Cloud SDK Error:", err)
            print("Error Code:", err.code)
            print("Error Message:", err.message)
            print("Request ID:", err.requestId)
            self.send_error_response(500, f"TTS API error: {err.message}")
            return None
            
        except Exception as e:
            print(f"Tencent TTS error: {str(e)}")
            traceback.print_exc()
            self.send_error_response(500, str(e))
            return None

    def proxy_face_swap(self, data):
        try:
            if 'source_image' not in data or 'target_image' not in data:
                raise Exception('Missing required images')

            # 解码Base64图片
            source_image = base64_to_image(data['source_image'])
            target_image = base64_to_image(data['target_image'])

            # 初始化人脸检测器和特征点检测器
            detector = dlib.get_frontal_face_detector()
            predictor = dlib.shape_predictor('shape_predictor_68_face_landmarks.dat')

            # 检测人脸
            source_faces = detector(source_image)
            target_faces = detector(target_image)

            if len(source_faces) == 0 or len(target_faces) == 0:
                raise Exception('No faces detected in one or both images')

            # 获取人脸尺寸
            source_face = source_faces[0]
            target_face = target_faces[0]
            source_face_width = source_face.right() - source_face.left()
            target_face_width = target_face.right() - target_face.left()

            # 计算缩放比例
            scale_factor = target_face_width / source_face_width
            
            # 缩放源图像
            if abs(scale_factor - 1.0) > 0.1:  # 如果缩放比例差异超过10%才进行缩放
                new_width = int(source_image.shape[1] * scale_factor)
                new_height = int(source_image.shape[0] * scale_factor)
                source_image = cv2.resize(source_image, (new_width, new_height))
                # 重新检测缩放后的人脸和特征点
                source_faces = detector(source_image)
                if len(source_faces) == 0:
                    raise Exception('Face detection failed after scaling')

            # 获取特征点
            source_landmarks = predictor(source_image, source_faces[0])
            target_landmarks = predictor(target_image, target_faces[0])

            # 转换特征点格式
            source_points = np.array([[p.x, p.y] for p in source_landmarks.parts()])
            target_points = np.array([[p.x, p.y] for p in target_landmarks.parts()])

            # 计算变换矩阵
            M = cv2.estimateAffinePartial2D(source_points, target_points)[0]

            # 变换源图像
            warped_source = cv2.warpAffine(source_image, M, (target_image.shape[1], target_image.shape[0]))

            # 创建蒙版
            mask = np.zeros_like(target_image)
            hull = cv2.convexHull(target_points)
            cv2.fillConvexPoly(mask, hull, (255, 255, 255))
            
            # 扩大蒙版区域以覆盖更多面部区域
            kernel = np.ones((5,5), np.uint8)
            mask = cv2.dilate(mask, kernel, iterations=2)
            mask = cv2.GaussianBlur(mask, (5, 5), 3)

            # 计算目标人脸的中心点
            face_center = target_faces[0].center()
            center_point = (int(face_center.x), int(face_center.y))

            # 进行颜色调整和图像混合
            result = cv2.seamlessClone(
                warped_source, 
                target_image, 
                mask, 
                center_point,
                cv2.NORMAL_CLONE
            )

            # 转换结果为JPEG格式
            _, buffer = cv2.imencode('.jpg', result)
            response_data = buffer.tobytes()

            # 发送响应
            self.send_response(200)
            self.send_header('Content-Type', 'image/jpeg')
            self.send_header('Content-Length', len(response_data))
            self.end_headers()
            self.wfile.write(response_data)

        except Exception as e:
            print(f"Face swap error: {str(e)}")
            traceback.print_exc()
            self.send_error_response(500, str(e))

    def do_GET(self):
        self.send_response(200)
        
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        elif self.path.endswith('.css'):
            self.send_header('Content-Type', 'text/css')
        elif self.path.endswith('.html') or self.path == '/':
            self.send_header('Content-Type', 'text/html')
        elif self.path.endswith('.wasm'):
            self.send_header('Content-Type', 'application/wasm')
            self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        
        return SimpleHTTPRequestHandler.do_GET(self)

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        error_response = {
            'error': {
                'code': code,
                'message': message
            }
        }
        print(f"Sending error response: {error_response}")  # 添加日志
        self.wfile.write(json.dumps(error_response).encode())

def signal_handler(sig, frame):
    print('\nShutting down server...')
    sys.exit(0)

def run_server(port=8000):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)
    
    print(f"Server directory: {current_dir}")
    print(f"Available files: {os.listdir('.')}")
    
    server_address = ('localhost', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f"Server running on http://localhost:{port}")
    
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server...')
        httpd.server_close()
        sys.exit(0)

def base64_to_image(base64_string):
    # 移除Base64前缀（如果有）
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    # 解码Base64
    image_data = base64.b64decode(base64_string)
    
    # 转换为numpy数组
    nparr = np.frombuffer(image_data, np.uint8)
    
    # 解码图像
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    return image

if __name__ == '__main__':
    run_server() 