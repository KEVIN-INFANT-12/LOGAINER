"""
ConvLSTM architecture for regional disruption-risk nowcasting.

Why ConvLSTM: each input sample is a sequence of spatial grids (rainfall,
flood/landslide pressure, traffic state) over the preceding hours. A plain
LSTM would have to flatten the grid and lose spatial adjacency (a flooded
cell affecting its neighbors); a plain CNN would lose the temporal ordering
(rainfall accumulating, congestion building). ConvLSTM2D applies a
convolution INSIDE the recurrent state update, so it learns spatial patterns
(local risk spreading across neighboring cells) and temporal patterns
(how those patterns evolve hour to hour) jointly, which is exactly the
structure of this problem.
"""
import tensorflow as tf
from tensorflow.keras import layers, models


def build_convlstm_model(sequence_length, grid_height, grid_width, num_channels,
                          filters=(32, 16), kernel_size=(3, 3), dropout=0.3,
                          learning_rate=1e-3):
    inputs = layers.Input(shape=(sequence_length, grid_height, grid_width, num_channels))

    x = layers.ConvLSTM2D(filters[0], kernel_size, padding="same", return_sequences=True)(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)

    x = layers.ConvLSTM2D(filters[1], kernel_size, padding="same", return_sequences=False)(x)
    x = layers.BatchNormalization()(x)

    x = layers.Conv2D(filters[1], kernel_size, padding="same", activation="relu")(x)
    x = layers.GlobalAveragePooling2D()(x)

    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    risk_output = layers.Dense(1, activation="sigmoid", name="risk_probability")(x)

    model = models.Model(inputs, risk_output, name="logainer_convlstm")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="binary_crossentropy",
        metrics=[
            tf.keras.metrics.AUC(name="auc"),
            tf.keras.metrics.AUC(name="pr_auc", curve="PR"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )
    return model


def focal_loss(gamma=2.0, alpha=0.25):
    """Optional loss for severe class imbalance (see class_imbalance report)."""
    def loss_fn(y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1 - 1e-7)
        pt = tf.where(tf.equal(y_true, 1), y_pred, 1 - y_pred)
        alpha_t = tf.where(tf.equal(y_true, 1), alpha, 1 - alpha)
        return tf.reduce_mean(-alpha_t * tf.pow(1 - pt, gamma) * tf.math.log(pt))
    return loss_fn
