import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

const App = () => {
    const [inputMode, setInputMode] = useState('image'); // 'image' or 'text'
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [textDescription, setTextDescription] = useState('');
    const [gender, setGender] = useState('menino'); // 'menino', 'menina'
    const [roomStyle, setRoomStyle] = useState('confortavel'); // 'colorido', 'chique', 'confortavel'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedImage, setGeneratedImage] = useState('');
    const [decorationTips, setDecorationTips] = useState('');
    const [babyEssentials, setBabyEssentials] = useState('');

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    setImagePreview(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const fileToGenerativePart = async (file) => {
        const base64EncodedDataPromise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result.split(',')[1]);
                } else {
                    reject(new Error('Failed to read file as data URL.'));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
    };

    const handleSubmit = useCallback(async () => {
        if (!imageFile && !textDescription) {
            setError('Por favor, envie uma imagem ou descreva o quarto.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImage('');
        setDecorationTips('');
        setBabyEssentials('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            let imagePart = null;
            if (imageFile) {
                imagePart = await fileToGenerativePart(imageFile);
            }

            const genderText = gender === 'neutro' ? 'de gênero neutro' : `para ${gender}`;
            const styleText = roomStyle;
            
            // --- Primeira chamada à API: Gerar Imagem ---
            const imagePrompt = inputMode === 'image'
                ? `Com base na imagem fornecida, gere uma nova imagem fotorrealista mostrando-a transformada em um quarto de bebê ${genderText} com estilo ${styleText}, que seja bonito e funcional. Seu design deve mostrar um posicionamento ideal e seguro para um berço. Preserve a arquitetura original do quarto: o tamanho, a forma e a posição de todas as janelas e portas devem ser idênticos à imagem original.`
                : `Com base nesta descrição de um quarto: "${textDescription}", gere uma imagem fotorrealista dele transformado em um quarto de bebê ${genderText} com estilo ${styleText}. A imagem deve mostrar um posicionamento ideal para o berço e refletir com precisão o layout descrito.`;
            
            const imageResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: imagePart ? [imagePart, { text: imagePrompt }] : [{ text: imagePrompt }] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const genImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (genImagePart) {
                const { data, mimeType } = genImagePart.inlineData;
                setGeneratedImage(`data:${mimeType};base64,${data}`);
            } else {
                 throw new Error("Não foi possível gerar a imagem. Tente novamente.");
            }

            // --- Segunda chamada à API: Gerar Texto ---
            const textPrompt = `Para o quarto fornecido ${inputMode === 'image' ? '' : `descrito como "${textDescription}"`}, forneça conselhos de decoração práticos e uma lista de itens essenciais para um quarto de bebê ${genderText} com estilo ${styleText}. Separe as duas seções com a string exata '---SPLIT---'. Não use markdown ou asteriscos. Mantenha os textos curtos.`;

            const textResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: imagePart ? [imagePart, { text: textPrompt }] : [{ text: textPrompt }] },
            });
            
            const [tips, essentials] = textResponse.text.split('---SPLIT---');
            setDecorationTips(tips.trim());
            setBabyEssentials(essentials.trim());

        } catch (err) {
            console.error(err);
            setError(err.message || 'Ocorreu um erro ao gerar as ideias. Por favor, tente novamente.');
        } finally {
            setIsLoading(false);
        }
    }, [imageFile, textDescription, inputMode, gender, roomStyle]);
    
    const handleReset = () => {
        setImageFile(null);
        setImagePreview('');
        setTextDescription('');
        setError(null);
        setGeneratedImage('');
        setDecorationTips('');
        setBabyEssentials('');
        const inputSection = document.querySelector('.input-section');
        if (inputSection) {
            inputSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const renderInput = () => {
        if (inputMode === 'image') {
            return (
                <div className="file-uploader">
                    <input type="file" id="file-upload" accept="image/*" onChange={handleImageChange} />
                    <label htmlFor="file-upload">Escolher uma Foto</label>
                    {imagePreview && <img id="image-preview" src={imagePreview} alt="Pré-visualização do quarto" />}
                </div>
            );
        }
        return (
            <div className="text-input">
                <textarea
                    placeholder="Ex: Um quarto de 3m x 4m com uma janela grande na parede norte e uma porta no canto sudoeste."
                    value={textDescription}
                    onChange={(e) => setTextDescription(e.target.value)}
                    aria-label="Descrição do quarto"
                />
            </div>
        );
    };

    return (
        <div className="app-container">
            <header className="header">
                <h1>Designer de Quarto de Bebê com IA</h1>
                <p>Transforme qualquer cômodo no ninho perfeito. Envie uma foto ou descreva seu espaço.</p>
            </header>

            <section className="input-section">
                <div className="tabs">
                    <button className={`tab ${inputMode === 'image' ? 'active' : ''}`} onClick={() => setInputMode('image')}>Enviar Foto</button>
                    <button className={`tab ${inputMode === 'text' ? 'active' : ''}`} onClick={() => setInputMode('text')}>Descrever Quarto</button>
                </div>
                
                <div className="options-container">
                    <div className="options-group">
                        <h3>Gênero</h3>
                        <div className="options-buttons">
                            <button className={`option-button ${gender === 'menino' ? 'active' : ''}`} onClick={() => setGender('menino')}>Menino</button>
                            <button className={`option-button ${gender === 'menina' ? 'active' : ''}`} onClick={() => setGender('menina')}>Menina</button>
                        </div>
                    </div>
                    <div className="options-group">
                        <h3>Estilo</h3>
                        <div className="options-buttons">
                            <button className={`option-button ${roomStyle === 'colorido' ? 'active' : ''}`} onClick={() => setRoomStyle('colorido')}>Colorido</button>
                            <button className={`option-button ${roomStyle === 'chique' ? 'active' : ''}`} onClick={() => setRoomStyle('chique')}>Chique</button>
                            <button className={`option-button ${roomStyle === 'confortavel' ? 'active' : ''}`} onClick={() => setRoomStyle('confortavel')}>Confortável</button>
                        </div>
                    </div>
                </div>

                {renderInput()}
                <div style={{ textAlign: 'center' }}>
                    {generatedImage && !isLoading ? (
                        <button className="generate-again-button" onClick={handleReset}>
                            Gerar Novamente
                        </button>
                    ) : (
                        <button className="generate-button" onClick={handleSubmit} disabled={isLoading || (!imageFile && !textDescription)}>
                            {isLoading ? 'Gerando...' : 'Gerar Ideias'}
                        </button>
                    )}
                </div>
            </section>

            {isLoading && (
                <div className="loading-overlay" aria-live="polite">
                    <div className="spinner"></div>
                    Projetando o quarto dos seus sonhos...
                </div>
            )}

            {error && <div className="error-message" role="alert">{error}</div>}

            {!isLoading && generatedImage && (
                 <section className={`results-section ${decorationTips || babyEssentials ? 'has-text-results' : ''}`}>
                    <div className="image-results result-card-base">
                        <h2>Nossa Sugestão Visual</h2>
                        <div className="image-comparison">
                            {imagePreview && (
                                <div>
                                    <h3>Antes</h3>
                                    <img src={imagePreview} alt="Quarto original" />
                                </div>
                            )}
                            <div>
                                <h3>{imagePreview ? 'Depois' : 'Sugestão'}</h3>
                                <img src={generatedImage} alt="Sugestão de design para o quarto do bebê" />
                            </div>
                        </div>
                    </div>
                    
                    {(decorationTips || babyEssentials) && (
                        <div className="text-results">
                             {decorationTips && (
                                 <div className="result-card result-card-base">
                                     <h2 className="decoration-title">Dicas de Decoração</h2>
                                     <p style={{ whiteSpace: 'pre-wrap' }}>{decorationTips}</p>
                                 </div>
                             )}
                             {babyEssentials && (
                                 <div className="result-card result-card-base">
                                     <h2 className="essentials-title">Itens Essenciais para o Bebê</h2>
                                     <p style={{ whiteSpace: 'pre-wrap' }}>{babyEssentials}</p>
                                 </div>
                             )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);